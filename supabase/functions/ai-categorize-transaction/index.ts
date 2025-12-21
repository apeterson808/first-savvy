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

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  detail_type?: string;
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

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, type, detail_type')
      .eq('user_id', user.id)
      .neq('detail_type', 'transfer')
      .order('name');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user categories' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No categories found for user' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const fallbackCategory = suggestCategoryFallback(description, amount, categories);
    if (fallbackCategory) {
      return new Response(
        JSON.stringify({
          category: fallbackCategory.name,
          type: fallbackCategory.type,
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

function suggestCategoryFallback(description: string, amount: number | undefined, categories: Category[]): Category | null {
  const descLower = description.toLowerCase();

  const patterns = [
    { keywords: ['grocery', 'food', 'market', 'safeway', 'whole foods', 'trader', 'costco', 'kroger'], categoryName: 'groceries' },
    { keywords: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'chipotle', 'dining', 'pizza', 'burger'], categoryName: 'dining' },
    { keywords: ['gas', 'fuel', 'shell', 'chevron', 'uber', 'lyft', 'taxi', 'transit', 'parking'], categoryName: 'transportation' },
    { keywords: ['amazon', 'target', 'walmart', 'best buy', 'shopping', 'store', 'retail'], categoryName: 'shopping' },
    { keywords: ['netflix', 'spotify', 'hulu', 'apple', 'subscription', 'membership', 'monthly'], categoryName: 'subscriptions' },
    { keywords: ['doctor', 'hospital', 'pharmacy', 'cvs', 'walgreens', 'medical', 'health', 'dental'], categoryName: 'health' },
    { keywords: ['electric', 'water', 'gas bill', 'internet', 'phone', 'verizon', 'att', 'comcast', 'utility'], categoryName: 'utilities' },
    { keywords: ['rent', 'mortgage', 'lease', 'housing', 'property'], categoryName: 'housing' },
    { keywords: ['insurance', 'premium'], categoryName: 'insurance' },
    { keywords: ['paycheck', 'salary', 'direct deposit', 'payroll', 'wages'], categoryName: 'salary' },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => descLower.includes(keyword))) {
      const matchedCategory = categories.find(c =>
        c.name.toLowerCase().includes(pattern.categoryName) ||
        pattern.categoryName.includes(c.name.toLowerCase())
      );
      if (matchedCategory) {
        return matchedCategory;
      }
    }
  }

  if (amount !== undefined && amount > 0) {
    const expenseCategory = categories.find(c => c.type === 'expense');
    if (expenseCategory) return expenseCategory;
  } else if (amount !== undefined && amount < 0) {
    const incomeCategory = categories.find(c => c.type === 'income');
    if (incomeCategory) return incomeCategory;
  }

  return null;
}