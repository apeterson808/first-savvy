import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, TrendingDown, Gift } from 'lucide-react';

export function ActivityTab({ childId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [childId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('child_transactions')
        .select('*')
        .eq('child_profile_id', childId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'chore_payment':
        return <Award className="h-5 w-5 text-green-600" />;
      case 'reward_redemption':
        return <Gift className="h-5 w-5 text-purple-600" />;
      case 'allowance':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      default:
        return <TrendingDown className="h-5 w-5 text-slate-600" />;
    }
  };

  const getTransactionLabel = (type) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return <div className="text-center py-8">Loading activity...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Recent Activity</h3>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-slate-600 py-8">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getTransactionLabel(transaction.transaction_type)}
                        </Badge>
                        <span className="text-xs text-slate-600">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.currency_type === 'cash'
                        ? `$${Math.abs(parseFloat(transaction.amount)).toFixed(2)}`
                        : `${Math.abs(transaction.amount)} pts`
                      }
                    </p>
                    <p className="text-xs text-slate-600">
                      Balance: {transaction.currency_type === 'cash'
                        ? `$${parseFloat(transaction.balance_after).toFixed(2)}`
                        : `${transaction.balance_after} pts`
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
