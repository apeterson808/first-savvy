import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAccountsForInstitution, getAvailableInstitutions, getStatementCache } from '@/api/bankSimulation';
import { Wallet, CreditCard, PiggyBank, Building2, CheckCircle2, Calendar, FileText } from 'lucide-react';

const getAccountTypeIcon = (accountType) => {
  switch (accountType) {
    case 'checking':
      return Wallet;
    case 'savings':
      return PiggyBank;
    case 'credit':
      return CreditCard;
    default:
      return Wallet;
  }
};

const getAccountTypeLabel = (accountType) => {
  switch (accountType) {
    case 'checking':
      return 'Checking Account';
    case 'savings':
      return 'Savings Account';
    case 'credit':
      return 'Credit Card';
    default:
      return accountType;
  }
};

export default function StatementCacheAccountSelector({ accountSubtype, selectedAccount, onSelectAccount }) {
  const [availableAccounts, setAvailableAccounts] = useState([]);

  const { data: institutions, isLoading: institutionsLoading } = useQuery({
    queryKey: ['available-institutions'],
    queryFn: getAvailableInstitutions,
  });

  useEffect(() => {
    const fetchAllAccounts = async () => {
      if (!institutions || institutions.length === 0) return;

      try {
        const allAccounts = [];

        for (const institution of institutions) {
          const accounts = await getAccountsForInstitution(institution.name);

          const accountTypeFilter = accountSubtype === 'checking' ? 'checking' :
                                   accountSubtype === 'savings' ? 'savings' :
                                   accountSubtype === 'credit_card' ? 'credit' : null;

          const filteredAccounts = accountTypeFilter
            ? accounts.filter(acc => acc.accountType === accountTypeFilter)
            : accounts;

          for (const account of filteredAccounts) {
            const statements = await getStatementCache(institution.name, account.accountType);

            if (statements && statements.length > 0) {
              const totalTransactions = statements.reduce((sum, stmt) => sum + (stmt.transaction_count || 0), 0);
              const sortedStatements = [...statements].sort((a, b) => {
                const yearDiff = a.statement_year - b.statement_year;
                if (yearDiff !== 0) return yearDiff;
                const monthOrder = { sep: 9, oct: 10, nov: 11, dec: 12 };
                return (monthOrder[a.statement_month] || 0) - (monthOrder[b.statement_month] || 0);
              });

              const earliestStatement = sortedStatements[0];
              const latestStatement = sortedStatements[sortedStatements.length - 1];

              allAccounts.push({
                ...account,
                institutionId: institution.id,
                institutionLogo: institution.logo_url,
                statementCount: statements.length,
                totalTransactions,
                earliestMonth: earliestStatement.statement_month,
                earliestYear: earliestStatement.statement_year,
                latestMonth: latestStatement.statement_month,
                latestYear: latestStatement.statement_year,
                statements
              });
            }
          }
        }

        setAvailableAccounts(allAccounts);
      } catch (error) {
        console.error('Error fetching cached accounts:', error);
      }
    };

    fetchAllAccounts();
  }, [institutions, accountSubtype]);

  if (institutionsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (availableAccounts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">No Cached Statements Available</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            No cached statement data found for {getAccountTypeLabel(accountSubtype)} accounts.
            You can upload a statement file instead.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDateRange = (earliestMonth, earliestYear, latestMonth, latestYear) => {
    const formatMonth = (month) => month.charAt(0).toUpperCase() + month.slice(1);
    if (earliestYear === latestYear && earliestMonth === latestMonth) {
      return `${formatMonth(earliestMonth)} ${earliestYear}`;
    }
    return `${formatMonth(earliestMonth)} ${earliestYear} - ${formatMonth(latestMonth)} ${latestYear}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select an account to import cached statement data
        </p>
      </div>

      {availableAccounts.map((account) => {
        const AccountIcon = getAccountTypeIcon(account.accountType);
        const isSelected = selectedAccount?.accountNumberLast4 === account.accountNumberLast4 &&
                          selectedAccount?.institutionName === account.institutionName;

        return (
          <Card
            key={`${account.institutionName}-${account.accountType}-${account.accountNumberLast4}`}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''
            }`}
            onClick={() => onSelectAccount(account)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <AccountIcon className="w-5 h-5 text-slate-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">
                        {account.institutionName} {getAccountTypeLabel(account.accountType)}
                      </p>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      ****{account.accountNumberLast4}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDateRange(account.earliestMonth, account.earliestYear, account.latestMonth, account.latestYear)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {account.totalTransactions} transactions
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {account.statementCount} statements
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAccount(account);
                  }}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
