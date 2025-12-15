import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Transaction {
  id: string;
  amount: number;
  date: string;
  description?: string;
  category?: string;
  category_id?: string;
  type: 'income' | 'expense' | 'transfer';
  status: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
}

interface BudgetSuggestion {
  category_id: string;
  category_name: string;
  suggested_amount: number;
  reasoning: string;
  monthly_average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { transactions, categories } = await req.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transactions provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const suggestions: BudgetSuggestion[] = [];

    const categoryMap = new Map<string, Category>();
    if (categories && Array.isArray(categories)) {
      categories.forEach((cat: Category) => categoryMap.set(cat.id, cat));
    }

    const expensesByCategory = new Map<string, number[]>();
    const incomeByCategory = new Map<string, number[]>();

    const sortedTransactions = transactions
      .filter((t: Transaction) => t.status === 'posted' && t.type !== 'transfer')
      .sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTransactions.forEach((t: Transaction) => {
      if (!t.category_id) return;

      const map = t.type === 'income' ? incomeByCategory : expensesByCategory;
      const amounts = map.get(t.category_id) || [];
      amounts.push(t.amount);
      map.set(t.category_id, amounts);
    });

    const analyzeCategoryTrend = (amounts: number[]): 'increasing' | 'decreasing' | 'stable' => {
      if (amounts.length < 3) return 'stable';
      
      const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
      const secondHalf = amounts.slice(Math.floor(amounts.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length;
      
      const change = (secondAvg - firstAvg) / firstAvg;
      
      if (change > 0.15) return 'increasing';
      if (change < -0.15) return 'decreasing';
      return 'stable';
    };

    const generateReasoning = (trend: string, monthlyAvg: number, type: string): string => {
      if (type === 'income') {
        if (trend === 'increasing') {
          return `Your income in this category has been growing. Budget reflects recent higher amounts.`;
        } else if (trend === 'decreasing') {
          return `Income trending down. Budget set conservatively based on recent months.`;
        }
        return `Stable income pattern. Budget based on 12-month average.`;
      } else {
        if (trend === 'increasing') {
          return `Spending is increasing. Consider reviewing this category to control costs.`;
        } else if (trend === 'decreasing') {
          return `You've been reducing spending here. Budget reflects this positive trend.`;
        }
        return `Consistent spending pattern. Budget based on historical average.`;
      }
    };

    const processCategory = (categoryId: string, amounts: number[], type: 'income' | 'expense') => {
      const category = categoryMap.get(categoryId);
      if (!category) return;

      const total = amounts.reduce((sum, a) => sum + a, 0);
      const monthlyAvg = total / 12;
      const trend = analyzeCategoryTrend(amounts);
      
      let suggestedAmount = monthlyAvg;
      
      if (type === 'expense') {
        if (trend === 'increasing') {
          suggestedAmount = monthlyAvg * 1.15;
        } else if (trend === 'decreasing') {
          suggestedAmount = monthlyAvg * 0.95;
        } else {
          suggestedAmount = monthlyAvg * 1.05;
        }
      } else {
        if (trend === 'increasing') {
          suggestedAmount = monthlyAvg * 1.05;
        } else if (trend === 'decreasing') {
          suggestedAmount = monthlyAvg * 0.9;
        }
      }
      
      suggestedAmount = Math.ceil(suggestedAmount / 10) * 10;
      suggestedAmount = Math.max(suggestedAmount, 10);

      suggestions.push({
        category_id: categoryId,
        category_name: category.name,
        suggested_amount: suggestedAmount,
        reasoning: generateReasoning(trend, monthlyAvg, type),
        monthly_average: Math.round(monthlyAvg * 100) / 100,
        trend,
        type,
        icon: category.icon,
        color: category.color,
      });
    };

    incomeByCategory.forEach((amounts, categoryId) => {
      processCategory(categoryId, amounts, 'income');
    });

    expensesByCategory.forEach((amounts, categoryId) => {
      processCategory(categoryId, amounts, 'expense');
    });

    suggestions.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'income' ? -1 : 1;
      }
      return b.suggested_amount - a.suggested_amount;
    });

    return new Response(
      JSON.stringify({ suggestions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error analyzing budget:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze budget', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
