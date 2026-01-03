import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, CheckSquare, Square } from 'lucide-react';

const formatMonthYear = (month, year) => {
  const monthNames = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December'
  };
  return `${monthNames[month] || month} ${year}`;
};

export default function TransactionDateRangeSelector({ statements, selectedStatements, onSelectionChange }) {
  const [localSelection, setLocalSelection] = useState(new Set());

  useEffect(() => {
    if (selectedStatements && selectedStatements.length > 0) {
      setLocalSelection(new Set(selectedStatements.map(s => s.id)));
    } else if (statements && statements.length > 0) {
      setLocalSelection(new Set(statements.map(s => s.id)));
    }
  }, [statements, selectedStatements]);

  useEffect(() => {
    if (statements && statements.length > 0) {
      const selected = statements.filter(s => localSelection.has(s.id));
      onSelectionChange(selected);
    }
  }, [localSelection, statements]);

  if (!statements || statements.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileText className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No Statements Available</p>
        </CardContent>
      </Card>
    );
  }

  const sortedStatements = [...statements].sort((a, b) => {
    const yearDiff = b.statement_year - a.statement_year;
    if (yearDiff !== 0) return yearDiff;
    const monthOrder = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return (monthOrder[b.statement_month] || 0) - (monthOrder[a.statement_month] || 0);
  });

  const totalSelectedTransactions = statements
    .filter(s => localSelection.has(s.id))
    .reduce((sum, s) => sum + (s.transaction_count || 0), 0);

  const handleToggle = (statementId) => {
    setLocalSelection(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statementId)) {
        newSet.delete(statementId);
      } else {
        newSet.add(statementId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setLocalSelection(new Set(statements.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setLocalSelection(new Set());
  };

  const allSelected = localSelection.size === statements.length;
  const someSelected = localSelection.size > 0 && localSelection.size < statements.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Select Statement Period</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
              className="h-7 text-xs"
            >
              {allSelected ? (
                <>
                  <Square className="w-3 h-3 mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="w-3 h-3 mr-1" />
                  Select All
                </>
              )}
            </Button>
          </div>
        </div>
        {localSelection.size > 0 && (
          <div className="flex gap-2 mt-2">
            <Badge variant="default" className="text-xs">
              {localSelection.size} statement{localSelection.size !== 1 ? 's' : ''} selected
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {totalSelectedTransactions} transactions
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {sortedStatements.map((statement) => {
          const isSelected = localSelection.has(statement.id);

          return (
            <div
              key={statement.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'
              }`}
              onClick={() => handleToggle(statement.id)}
            >
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(statement.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {formatMonthYear(statement.statement_month, statement.statement_year)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <span className="text-xs text-muted-foreground">
                      {statement.transaction_count || 0} transactions
                    </span>
                    {statement.total_debits > 0 && (
                      <span className="text-xs text-red-600">
                        ${Math.abs(statement.total_debits).toFixed(2)} debits
                      </span>
                    )}
                    {statement.total_credits > 0 && (
                      <span className="text-xs text-green-600">
                        ${statement.total_credits.toFixed(2)} credits
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {statement.file_name && (
                <Badge variant="outline" className="text-xs ml-2">
                  <FileText className="w-3 h-3 mr-1" />
                  {statement.file_name.split('_').slice(-1)[0].replace('.pdf', '')}
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
