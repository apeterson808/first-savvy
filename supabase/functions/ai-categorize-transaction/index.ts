import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ChartAccount {
  id: string;
  account_number: number;
  account_type: 'income' | 'expense' | 'asset' | 'liability' | 'equity';
  account_detail?: string;
  category?: string;
  custom_display_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { description, amount } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: 'Description is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: chartAccounts, error: chartAccountsError } = await supabase
      .from('user_chart_of_accounts')
      .select('id, account_number, class, account_type, account_detail, display_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('class', ['income', 'expense'])
      .order('account_number');

    if (chartAccountsError) {
      console.error('Error fetching chart accounts:', chartAccountsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user chart accounts' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!chartAccounts || chartAccounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No chart accounts found for user' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fallbackAccount = suggestChartAccountFallback(description, amount, chartAccounts);
    if (fallbackAccount) {
      return new Response(
        JSON.stringify({
          chartAccountId: fallbackAccount.id,
          accountNumber: fallbackAccount.account_number,
          category: fallbackAccount.custom_display_name || fallbackAccount.category,
          type: fallbackAccount.account_type,
          confidence: 'pattern',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    return new Response(
      JSON.stringify({
        chartAccountId: null,
        category: null,
        type: null,
        confidence: 'none',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error categorizing transaction:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to categorize transaction',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function suggestChartAccountFallback(description: string, amount: number | undefined, chartAccounts: ChartAccount[]): ChartAccount | null {
  const descLower = description.toLowerCase();

  const patterns = [
    { keywords: ['grocery', 'food', 'market', 'safeway', 'whole foods', 'trader', 'costco', 'kroger'], categoryName: 'groceries', accountNumber: 5030 },
    { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', 'dining', 'pizza', 'burger'], categoryName: 'dining out', accountNumber: 5031 },
    { keywords: ['gas', 'fuel', 'shell', 'chevron'], categoryName: 'gas & fuel', accountNumber: 5041 },
    { keywords: ['uber', 'lyft', 'taxi', 'transit', 'parking'], categoryName: 'transportation', accountNumber: 5040 },
    { keywords: ['amazon', 'target', 'walmart', 'best buy', 'store', 'retail'], categoryName: 'shopping', accountNumber: 5091 },
    { keywords: ['netflix', 'spotify', 'hulu', 'apple music', 'youtube premium'], categoryName: 'subscriptions', accountNumber: 5090 },
    { keywords: ['doctor', 'hospital', 'pharmacy', 'cvs', 'walgreens', 'dental'], categoryName: 'healthcare', accountNumber: 5060 },
    { keywords: ['electric', 'water', 'gas bill', 'utility'], categoryName: 'utilities', accountNumber: 5020 },
    { keywords: ['internet', 'phone', 'verizon', 'att', 'comcast'], categoryName: 'internet', accountNumber: 5021 },
    { keywords: ['rent', 'mortgage', 'lease', 'housing'], categoryName: 'rent / mortgage', accountNumber: 5011 },
    { keywords: ['insurance', 'premium'], categoryName: 'insurance', accountNumber: 5050 },
    { keywords: ['paycheck', 'salary', 'direct deposit', 'payroll', 'wages'], categoryName: 'salary', accountNumber: 4011 },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => descLower.includes(keyword))) {
      const matchedAccount = chartAccounts.find(c =>
        c.account_number === pattern.accountNumber ||
        (c.category && c.category.toLowerCase().includes(pattern.categoryName)) ||
        (c.custom_display_name && c.custom_display_name.toLowerCase().includes(pattern.categoryName))
      );
      if (matchedAccount) {
        return matchedAccount;
      }
    }
  }

  if (amount !== undefined && amount > 0) {
    const expenseAccount = chartAccounts.find(c => c.account_type === 'expense' && c.category);
    if (expenseAccount) return expenseAccount;
  } else if (amount !== undefined && amount < 0) {
    const incomeAccount = chartAccounts.find(c => c.account_type === 'income' && c.category);
    if (incomeAccount) return incomeAccount;
  }

  return null;
}