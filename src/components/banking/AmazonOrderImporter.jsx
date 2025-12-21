import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AmazonOrderImporter({ open, onOpenChange, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [parsedOrders, setParsedOrders] = useState(null);
  const [matchedTransactions, setMatchedTransactions] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => firstsavvy.entities.Transaction.list('-date', 1000),
    enabled: open
  });

  const parseAmazonCsv = async (text) => {
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const findColumn = (possibleNames) => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const orderDateIdx = findColumn(['order date', 'orderdate']);
    const orderIdIdx = findColumn(['order id', 'orderid', 'order #']);
    const titleIdx = findColumn(['title', 'product name', 'item name']);
    const sellerIdx = findColumn(['seller', 'sold by']);
    const priceIdx = findColumn(['item subtotal', 'item total', 'total', 'price']);
    const quantityIdx = findColumn(['quantity', 'qty']);
    const shipDateIdx = findColumn(['shipment date', 'shipped date', 'delivery date']);
    const trackingIdx = findColumn(['tracking', 'tracking number']);
    const urlIdx = findColumn(['url', 'product url', 'link']);

    if (orderDateIdx === -1 || orderIdIdx === -1) {
      throw new Error('Required columns not found. Make sure the CSV has "Order Date" and "Order ID" columns.');
    }

    const orders = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = [];
      let currentValue = '';
      let inQuotes = false;

      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));

      if (values.length < headers.length) continue;

      const parseDateStr = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [month, day, year] = parts;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return null;
      };

      const parsePrice = (priceStr) => {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[^0-9.-]/g, '')) || 0;
      };

      const orderDate = parseDateStr(values[orderDateIdx]);
      const orderId = values[orderIdIdx];

      if (!orderDate || !orderId) continue;

      orders.push({
        order_date: orderDate,
        order_id: orderId,
        product_name: titleIdx !== -1 ? values[titleIdx] : 'Unknown Product',
        seller: sellerIdx !== -1 ? values[sellerIdx] : 'Amazon',
        amount: priceIdx !== -1 ? parsePrice(values[priceIdx]) : 0,
        quantity: quantityIdx !== -1 ? parseInt(values[quantityIdx]) || 1 : 1,
        shipment_date: shipDateIdx !== -1 ? parseDateStr(values[shipDateIdx]) : null,
        tracking_number: trackingIdx !== -1 ? values[trackingIdx] : null,
        product_url: urlIdx !== -1 ? values[urlIdx] : null
      });
    }

    return orders;
  };

  const matchOrdersToTransactions = (orders) => {
    const matches = [];

    for (const order of orders) {
      let bestMatch = null;
      let bestConfidence = 0;

      for (const txn of transactions) {
        if (txn.is_amazon_order) continue;

        let confidence = 0;
        const txnDate = new Date(txn.date);
        const orderDate = new Date(order.order_date);
        const daysDiff = Math.abs((txnDate - orderDate) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 2) {
          confidence += 40;
        } else if (daysDiff <= 7) {
          confidence += 20;
        } else {
          continue;
        }

        const amountDiff = Math.abs(txn.amount - order.amount);
        const amountMatchPercent = 1 - (amountDiff / Math.max(txn.amount, order.amount));

        if (amountMatchPercent > 0.95) {
          confidence += 40;
        } else if (amountMatchPercent > 0.85) {
          confidence += 25;
        } else if (amountMatchPercent > 0.7) {
          confidence += 15;
        } else {
          continue;
        }

        const desc = (txn.description || '').toLowerCase();
        if (desc.includes('amazon') || desc.includes('amzn')) {
          confidence += 20;
        } else if (desc.includes('marketplace')) {
          confidence += 10;
        }

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = txn;
        }
      }

      matches.push({
        order,
        transaction: bestMatch,
        confidence: bestConfidence
      });
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext === 'csv') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a CSV file');
        setFile(null);
      }
    }
  };

  const handleParse = async () => {
    if (!file) return;

    try {
      setIsParsing(true);
      setError(null);

      const text = await file.text();
      const orders = await parseAmazonCsv(text);

      if (orders.length === 0) {
        throw new Error('No valid orders found in the CSV file');
      }

      setParsedOrders(orders);
      toast.success(`Found ${orders.length} Amazon orders`);

      setIsParsing(false);
      setIsMatching(true);

      const matches = matchOrdersToTransactions(orders);
      setMatchedTransactions(matches);
      setIsMatching(false);

      const highConfidenceMatches = matches.filter(m => m.confidence >= 60);
      toast.success(`Matched ${highConfidenceMatches.length} orders to existing transactions`);

    } catch (err) {
      setIsParsing(false);
      setIsMatching(false);
      const errorMsg = err.message || 'Failed to parse Amazon orders';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleConfirmImport = async () => {
    if (!matchedTransactions) return;

    try {
      const updates = matchedTransactions
        .filter(m => m.transaction && m.confidence >= 60)
        .map(m => ({
          id: m.transaction.id,
          amazon_order_id: m.order.order_id,
          amazon_order_date: m.order.order_date,
          amazon_shipment_date: m.order.shipment_date,
          amazon_tracking_number: m.order.tracking_number,
          amazon_product_name: m.order.product_name,
          amazon_product_quantity: m.order.quantity,
          amazon_product_url: m.order.product_url,
          amazon_seller: m.order.seller,
          is_amazon_order: true,
          match_confidence: m.confidence
        }));

      for (const update of updates) {
        await firstsavvy.entities.Transaction.update(update.id, update);
      }

      toast.success(`Successfully enriched ${updates.length} transactions with Amazon order data`);

      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      reset();
      onImportComplete?.();
      onOpenChange(false);

    } catch (err) {
      toast.error('Failed to import Amazon orders');
      setError(err.message);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedOrders(null);
    setMatchedTransactions(null);
    setError(null);
    setIsParsing(false);
    setIsMatching(false);
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 80) {
      return <Badge variant="default" className="bg-green-600">High ({confidence}%)</Badge>;
    } else if (confidence >= 60) {
      return <Badge variant="default" className="bg-yellow-600">Medium ({confidence}%)</Badge>;
    } else {
      return <Badge variant="secondary">Low ({confidence}%)</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen);
      if (!newOpen) reset();
    }}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Import Amazon Orders
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-4">
          {matchedTransactions ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Found {matchedTransactions.filter(m => m.confidence >= 60).length} high-confidence matches
                  </p>
                  <p className="text-xs text-green-700">
                    Review and confirm the matches below
                  </p>
                </div>
              </div>

              <ScrollArea className="h-[500px] border rounded-lg">
                <div className="divide-y">
                  {matchedTransactions
                    .filter(m => m.transaction && m.confidence >= 60)
                    .map((match, idx) => (
                      <div key={idx} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {match.order.product_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Order #{match.order.order_id}
                            </p>
                          </div>
                          {getConfidenceBadge(match.confidence)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Order Date:</span>
                            <span className="ml-1 font-medium">{match.order.order_date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Amount:</span>
                            <span className="ml-1 font-medium">${match.order.amount.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <p className="text-xs font-medium text-slate-700 mb-1">Matched Transaction:</p>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-slate-900">{match.transaction.description}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {match.transaction.date} • ${match.transaction.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {match.order.product_url && (
                          <a
                            href={match.order.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            View on Amazon <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>

              {matchedTransactions.filter(m => !m.transaction || m.confidence < 60).length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900">
                    {matchedTransactions.filter(m => !m.transaction || m.confidence < 60).length} orders could not be matched
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    These orders may not have corresponding transactions yet or the confidence score was too low
                  </p>
                </div>
              )}
            </>
          ) : !parsedOrders ? (
            <>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    How to export your Amazon order history:
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Go to Amazon.com and sign in to your account</li>
                    <li>Navigate to "Returns & Orders"</li>
                    <li>Click "Order History Report" in the top right</li>
                    <li>Select date range and click "Request Report"</li>
                    <li>Download the CSV file when ready</li>
                  </ol>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <Label htmlFor="amazon-file-upload" className="cursor-pointer">
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      Choose Amazon CSV file
                    </span>
                    <span className="text-sm text-slate-500"> or drag and drop</span>
                  </Label>
                  <p className="text-xs text-slate-500 mt-2">Amazon Order History Report (CSV)</p>
                  <Input
                    id="amazon-file-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {file && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-5 h-5 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    {!isParsing && !isMatching && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFile(null)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 mb-1">Import Error</p>
                      <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
                    </div>
                  </div>
                )}

                {(isParsing || isMatching) && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-sm text-blue-800">
                      {isParsing ? 'Parsing Amazon orders...' : 'Matching orders to transactions...'}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <SheetFooter>
          {matchedTransactions ? (
            <>
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={matchedTransactions.filter(m => m.transaction && m.confidence >= 60).length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm & Import
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={!file || isParsing || isMatching}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isParsing || isMatching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Parse & Match'
                )}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
