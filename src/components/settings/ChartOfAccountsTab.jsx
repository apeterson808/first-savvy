import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus } from 'lucide-react';
import { getUserChartOfAccounts } from '@/api/chartOfAccounts';
import { useProfile } from '@/contexts/ProfileContext';
import { getIconComponent } from '@/components/utils/iconMapper';
import { formatCurrency } from '@/components/utils/formatters';
import AccountRegister from '@/components/accounting/AccountRegister';
import CreateJournalEntry from '@/components/accounting/CreateJournalEntry';

export default function ChartOfAccountsTab() {
  const { activeProfile } = useProfile();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showCreateJE, setShowCreateJE] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['chart-of-accounts', activeProfile?.id],
    queryFn: () => getUserChartOfAccounts(activeProfile.id),
    enabled: !!activeProfile
  });

  if (selectedAccount) {
    return <AccountRegister account={selectedAccount} onBack={() => setSelectedAccount(null)} />;
  }

  if (showCreateJE) {
    return <CreateJournalEntry onClose={() => setShowCreateJE(false)} />;
  }

  const groupedAccounts = accounts.reduce((groups, account) => {
    const className = account.account_class || 'Other';
    if (!groups[className]) groups[className] = [];
    groups[className].push(account);
    return groups;
  }, {});

  const classOrder = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">
            View account registers and create journal entries
          </p>
        </div>
        <Button onClick={() => setShowCreateJE(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Journal Entry
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">Loading accounts...</CardContent>
        </Card>
      ) : (
        classOrder.map(className => {
          const classAccounts = groupedAccounts[className] || [];
          if (classAccounts.length === 0) return null;

          return (
            <Card key={className}>
              <CardHeader>
                <CardTitle>{className} Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classAccounts.map(account => {
                      const Icon = account.icon ? getIconComponent(account.icon) : null;
                      return (
                        <TableRow
                          key={account.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedAccount(account)}
                        >
                          <TableCell className="font-mono">{account.account_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {Icon && <Icon className="h-4 w-4" style={{ color: account.color }} />}
                              <span className="font-medium">{account.account_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{account.account_detail}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.is_active ? 'default' : 'secondary'}>
                              {account.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4 mr-2" />
                              View Register
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
