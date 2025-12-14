import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingDown, Home, Car, GraduationCap, CreditCard, Wallet, Building } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { LIABILITY_TYPE_LABELS } from '../utils/constants';

const LIABILITY_TYPE_ICONS = {
  mortgage: Home,
  car_loan: Car,
  student_loan: GraduationCap,
  credit_card: CreditCard,
  personal_loan: Wallet,
  other: Building
};

const LIABILITY_TYPE_COLORS = {
  mortgage: 'bg-blue-100 text-blue-600',
  car_loan: 'bg-purple-100 text-purple-600',
  student_loan: 'bg-amber-100 text-amber-600',
  credit_card: 'bg-red-100 text-red-600',
  personal_loan: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600'
};

export default function LiabilitiesTab() {
  const { data: liabilities = [] } = useQuery({
    queryKey: ['liabilities'],
    queryFn: () => base44.entities.Liability.list()
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const creditCards = bankAccounts.filter(a => a.account_type === 'credit_card');

  const totalLoans = liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0);
  const totalCreditCards = creditCards.reduce((sum, c) => sum + Math.abs(c.current_balance || 0), 0);
  const totalLiabilities = totalLoans + totalCreditCards;

  // Group liabilities by type
  const liabilitiesByType = liabilities.reduce((acc, l) => {
    const type = l.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(l);
    return acc;
  }, {});

  const getTypeLabel = (type) => LIABILITY_TYPE_LABELS[type] || type;

  return (
    <div className="p-3 space-y-3">
      {/* Liability Summary */}
      <Card className="bg-gradient-to-r from-red-500 to-rose-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Total Liabilities</p>
              <p className="text-3xl font-bold">{formatCurrency(totalLiabilities, { absoluteValue: true })}</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-200" />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Loans & Debts</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalLoans, { absoluteValue: true })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Credit Cards</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalCreditCards, { absoluteValue: true })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Cards */}
      {creditCards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Credit Cards</p>
              <span className="text-sm font-medium text-red-600">{formatCurrency(totalCreditCards, { absoluteValue: true })}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {creditCards.map(card => (
                <div key={card.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-600">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{card.account_name}</p>
                      {card.description && (
                        <p className="text-xs text-slate-500">{card.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-red-600">{formatCurrency(card.current_balance, { absoluteValue: true })}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loans by Type */}
      {Object.entries(liabilitiesByType).map(([type, items]) => {
        const Icon = LIABILITY_TYPE_ICONS[type] || Building;
        const colorClass = LIABILITY_TYPE_COLORS[type] || LIABILITY_TYPE_COLORS.other;
        const typeTotal = items.reduce((sum, l) => sum + (l.current_balance || 0), 0);

        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{getTypeLabel(type)}</p>
                <span className="text-sm font-medium text-red-600">{formatCurrency(typeTotal, { absoluteValue: true })}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map(liability => (
                  <div key={liability.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{liability.name}</p>
                        {liability.description && (
                          <p className="text-xs text-slate-500">{liability.description}</p>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-red-600">{formatCurrency(liability.current_balance, { absoluteValue: true })}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Empty State */}
      {liabilities.length === 0 && creditCards.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No Liabilities</p>
            <p className="text-sm text-slate-500 mt-1">
              Add loans or credit cards from the Banking page
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}