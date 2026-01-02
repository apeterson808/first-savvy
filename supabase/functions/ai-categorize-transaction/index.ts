import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ChartAccount {
  id: string;
  account_number: number;
  class: string;
  account_type: string;
  account_detail?: string;
  display_name?: string;
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
          category: fallbackAccount.display_name,
          type: fallbackAccount.class,
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
    { keywords: ['grocery', 'food', 'market', 'safeway', 'whole foods', 'trader', 'costco', 'kroger'], categoryNames: ['groceries'] },
    { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', 'dining', 'pizza', 'burger', 'wendys', 'subway', 'taco bell', 'shake shack', 'five guys', 'red lobster', 'olive garden', 'chilis', 'texas roadhouse', 'panera', 'panda express', 'dunkin'], categoryNames: ['dining out'] },
    { keywords: ['chevron', 'shell', 'exxon', 'mobil', 'bp', '76 gas', 'arco', 'circle k', 'marathon', 'wawa'], categoryNames: ['gas & fuel', 'gas', 'fuel'] },
    { keywords: ['uber', 'lyft', 'taxi', 'transit', 'parking', 'united airlines', 'airbnb'], categoryNames: ['transportation', 'travel'] },
    { keywords: ['amazon', 'target', 'walmart', 'best buy', 'ikea', 'home depot', 'bed bath', 'wayfair', 'kohls', 'macys', 'ebay', 'petco'], categoryNames: ['shopping'] },
    { keywords: ['netflix', 'spotify', 'hulu', 'apple music', 'youtube premium', 'disney plus', 'hbo max'], categoryNames: ['subscriptions'] },
    { keywords: ['doctor', 'hospital', 'pharmacy', 'cvs', 'walgreens', 'dental', 'urgent care', 'vision center', 'kaiser'], categoryNames: ['healthcare', 'medical'] },
    { keywords: ['comcast', 'spectrum', 'cox internet', 'verizon', 'att', 't-mobile', 'sprint'], categoryNames: ['utilities', 'internet', 'phone'] },
    { keywords: ['rent', 'mortgage', 'lease', 'plumber', 'home maintenance'], categoryNames: ['rent / mortgage', 'housing', 'home maintenance'] },
    { keywords: ['state farm', 'geico', 'insurance', 'premium'], categoryNames: ['insurance'] },
    { keywords: ['paycheck', 'salary', 'direct deposit', 'payroll', 'wages'], categoryNames: ['salary', 'commission'] },
    { keywords: ['interest payment', 'interest'], categoryNames: ['interest income'] },
    { keywords: ['vet clinic', 'chewy.com', 'pet'], categoryNames: ['pets'] },
    { keywords: ['jiffy lube', 'pep boys', 'oreilly auto', 'tire center'], categoryNames: ['auto maintenance', 'transportation'] },
    { keywords: ['dave & busters', 'entertainment'], categoryNames: ['entertainment'] },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => descLower.includes(keyword))) {
      for (const categoryName of pattern.categoryNames) {
        const matchedAccount = chartAccounts.find(c =>
          c.display_name && c.display_name.toLowerCase().includes(categoryName)
        );
        if (matchedAccount) {
          return matchedAccount;
        }
      }
    }
  }

  if (amount !== undefined && amount > 0) {
    const expenseAccount = chartAccounts.find(c => c.class === 'expense');
    if (expenseAccount) return expenseAccount;
  } else if (amount !== undefined && amount < 0) {
    const incomeAccount = chartAccounts.find(c => c.class === 'income');
    if (incomeAccount) return incomeAccount;
  }

  return null;
}
