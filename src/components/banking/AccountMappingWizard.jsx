import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { plaidAPI } from '@/api/plaidClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AccountMappingWizard({ open, onClose, plaidData, onComplete }) {
  const [accountMappings, setAccountMappings] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_name');
      return accounts || [];
    },
    enabled: open,
  });

  const { data: existingCreditCards = [] } = useQuery({
    queryKey: ['creditCards'],
    queryFn: async () => {
      const { data: cards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('is_active', true)
        .order('name');
      return cards || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (plaidData?.accounts && open) {
      const mappings = plaidData.accounts.map((account) => {
        const accountType = determineAccountType(account);
        return {
          plaid_account_id: account.account_id,
          name: account.name,
          official_name: account.official_name,
          mask: account.mask,
          balance: account.balances.current,
          plaid_type: account.type,
          plaid_subtype: account.subtype,
          account_type: accountType,
          mapping_type: 'create',
          local_account_id: null,
          new_account_name: account.official_name || account.name,
          start_date: subDays(new Date(), 90),
          go_live_date: subDays(new Date(), 7),
        };
      });
      setAccountMappings(mappings);
    }
  }, [plaidData, open]);

  const determineAccountType = (account) => {
    if (account.type === 'credit') return 'credit_card';
    if (account.subtype === 'checking') return 'checking';
    if (account.subtype === 'savings') return 'savings';
    return 'checking';
  };

  const updateMapping = (index, updates) => {
    setAccountMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const getCompatibleAccounts = (mapping) => {
    if (mapping.account_type === 'credit_card') {
      return existingCreditCards;
    }
    return existingAccounts.filter(acc =>
      acc.account_type === mapping.account_type ||
      (mapping.account_type === 'checking' && acc.account_type === 'savings') ||
      (mapping.account_type === 'savings' && acc.account_type === 'checking')
    );
  };

  const handleComplete = async () => {
    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const createdAccounts = [];

      for (const mapping of accountMappings) {
        if (mapping.mapping_type === 'create') {
          if (mapping.account_type === 'credit_card') {
            const { data, error } = await supabase
              .from('credit_cards')
              .insert({
                user_id: user.id,
                name: mapping.new_account_name,
                last_four: mapping.mask,
                current_balance: Math.abs(mapping.balance),
                credit_limit: mapping.balance < 0 ? 5000 : 0,
                institution: plaidData.institution?.name,
                institution_logo_url: plaidData.institution?.logo,
                plaid_account_id: mapping.plaid_account_id,
                plaid_item_id: plaidData.item_id,
              })
              .select()
              .single();

            if (error) throw error;
            createdAccounts.push({ ...data, account_type: 'credit_card' });
          } else {
            const { data, error } = await supabase
              .from('accounts')
              .insert({
                user_id: user.id,
                account_name: mapping.new_account_name,
                account_type: mapping.account_type,
                account_number: `****${mapping.mask}`,
                mask: mapping.mask,
                current_balance: mapping.balance,
                available_balance: mapping.balance,
                institution_name: plaidData.institution?.name,
                official_name: mapping.official_name,
                plaid_account_id: mapping.plaid_account_id,
                plaid_item_id: plaidData.item_id,
                plaid_type: mapping.plaid_type,
                plaid_subtype: mapping.plaid_subtype,
              })
              .select()
              .single();

            if (error) throw error;
            createdAccounts.push({ ...data, account_type: mapping.account_type });
          }
        } else if (mapping.mapping_type === 'link') {
          if (mapping.account_type === 'credit_card') {
            const { error } = await supabase
              .from('credit_cards')
              .update({
                plaid_account_id: mapping.plaid_account_id,
                plaid_item_id: plaidData.item_id,
              })
              .eq('id', mapping.local_account_id);

            if (error) throw error;

            const existingAccount = existingCreditCards.find(a => a.id === mapping.local_account_id);
            if (existingAccount) {
              createdAccounts.push({ ...existingAccount, account_type: 'credit_card' });
            }
          } else {
            const { error } = await supabase
              .from('accounts')
              .update({
                plaid_account_id: mapping.plaid_account_id,
                plaid_item_id: plaidData.item_id,
                plaid_type: mapping.plaid_type,
                plaid_subtype: mapping.plaid_subtype,
              })
              .eq('id', mapping.local_account_id);

            if (error) throw error;

            const existingAccount = existingAccounts.find(a => a.id === mapping.local_account_id);
            if (existingAccount) {
              createdAccounts.push({ ...existingAccount, account_type: mapping.account_type });
            }
          }
        }
      }

      const importMappings = accountMappings.map((mapping, index) => ({
        item_id: plaidData.item_id,
        plaid_account_id: mapping.plaid_account_id,
        local_account_id: mapping.mapping_type === 'create'
          ? createdAccounts[accountMappings.filter((m, i) => i < index && m.mapping_type === 'create').length]?.id
          : mapping.local_account_id,
        account_type: mapping.account_type,
        start_date: format(mapping.start_date, 'yyyy-MM-dd'),
        go_live_date: format(mapping.go_live_date, 'yyyy-MM-dd'),
      }));

      const transactionsResult = await plaidAPI.importTransactions(importMappings);

      toast.success(
        `Successfully connected ${createdAccounts.length} accounts and imported ${transactionsResult.transactions_imported} transactions!`,
        { duration: 5000 }
      );

      onComplete?.({ accounts: createdAccounts, transactionsImported: transactionsResult.transactions_imported });
      onClose();
    } catch (error) {
      console.error('Error completing account mapping:', error);
      toast.error('Failed to complete account setup');
    } finally {
      setIsImporting(false);
    }
  };

  if (!plaidData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map Your Accounts</DialogTitle>
          <DialogDescription>
            Configure how your {plaidData.institution?.name || 'bank'} accounts should be imported
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {accountMappings.map((mapping, index) => (
            <div key={mapping.plaid_account_id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{mapping.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      ···· {mapping.mask}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {mapping.account_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  {mapping.official_name && mapping.official_name !== mapping.name && (
                    <p className="text-sm text-muted-foreground mt-1">{mapping.official_name}</p>
                  )}
                  <p className="text-sm font-medium mt-1">
                    Balance: ${Math.abs(mapping.balance).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>How would you like to import this account?</Label>
                <RadioGroup
                  value={mapping.mapping_type}
                  onValueChange={(value) => updateMapping(index, { mapping_type: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id={`create-${index}`} />
                    <Label htmlFor={`create-${index}`} className="font-normal cursor-pointer">
                      Create new account
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="link" id={`link-${index}`} />
                    <Label htmlFor={`link-${index}`} className="font-normal cursor-pointer">
                      Link to existing account
                    </Label>
                  </div>
                </RadioGroup>

                {mapping.mapping_type === 'create' ? (
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input
                      value={mapping.new_account_name}
                      onChange={(e) => updateMapping(index, { new_account_name: e.target.value })}
                      placeholder="Enter account name"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Select Existing Account</Label>
                    <Select
                      value={mapping.local_account_id}
                      onValueChange={(value) => updateMapping(index, { local_account_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an account" />
                      </SelectTrigger>
                      <SelectContent>
                        {getCompatibleAccounts(mapping).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name || account.name} ({account.account_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !mapping.start_date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {mapping.start_date ? format(mapping.start_date, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={mapping.start_date}
                          onSelect={(date) => updateMapping(index, { start_date: date })}
                          disabled={(date) => date > new Date() || date < subDays(new Date(), 730)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Historical transactions from this date
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Go Live Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !mapping.go_live_date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {mapping.go_live_date ? format(mapping.go_live_date, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={mapping.go_live_date}
                          onSelect={(date) => updateMapping(index, { go_live_date: date })}
                          disabled={(date) => date > new Date() || date < mapping.start_date}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Transactions after need review
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isImporting} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={isImporting} className="flex-1">
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Setup
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
