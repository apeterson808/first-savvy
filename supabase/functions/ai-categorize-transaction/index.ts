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

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'AI service not configured'
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const categoryList = categories.map(c => `${c.name} (${c.type})`).join(', ');

    const prompt = `Analyze this transaction and suggest the most appropriate category from the list below.

Transaction description: "${description}"
Amount: ${amount || 'unknown'}

Available categories:
${categoryList}

Respond with ONLY the category name exactly as it appears in the list above. Do not include the type in parentheses.

General categorization guidelines:
- Grocery stores (Whole Foods, Trader Joe's, Safeway, Kroger, Costco, etc.) → Look for "Groceries" or similar
- Restaurants, cafes, food delivery (Starbucks, McDonald's, Chipotle, DoorDash, Uber Eats, etc.) → Look for "Dining Out" or "Dining" or "Food" or similar
- Gas stations, car maintenance, public transit, rideshare (Shell, Chevron, Uber, Lyft, etc.) → Look for "Transportation" or "Auto" or similar
- Retail stores, online shopping, general merchandise (Amazon, Target, Walmart, Best Buy, etc.) → Look for "Shopping" or "Personal" or "Lifestyle" or similar
- Streaming services, gym memberships, recurring software (Netflix, Spotify, Hulu, Apple, etc.) → Look for "Subscriptions" or similar
- Doctor, pharmacy, hospital, fitness, wellness (CVS, Walgreens, medical centers, etc.) → Look for "Health" or "Wellness" or "Medical" or similar
- Electric, water, gas, internet, phone bills (PG&E, AT&T, Verizon, Comcast, etc.) → Look for "Utilities" or similar
- Rent, mortgage, home repairs, property expenses → Look for "Housing" or "Rent" or "Home" or similar
- Insurance premiums (auto, health, home, life) → Look for "Insurance" or similar
- Schools, courses, books, educational materials → Look for "Education" or similar
- Childcare, toys, kids activities, family expenses → Look for "Family" or "Kids" or similar
- Donations, charitable giving, gifts to others → Look for "Giving" or "Charity" or "Donations" or similar
- Movies, concerts, events, entertainment venues (AMC, theaters, etc.) → Look for "Entertainment" or "Personal" or similar
- Flights, hotels, vacation expenses → Look for "Travel" or "Vacation" or similar
- Bank fees, investment fees, debt payments, loan payments → Look for "Financial" or "Banking" or similar
- Tax payments, tax preparation → Look for "Taxes" or similar
- Paycheck, salary, direct deposit from employer → Look for "Salary" or "Income" or similar
- Gift money received, bonuses, refunds → Look for "Gifts" or similar income category
- Anything that doesn't fit well → Look for "Miscellaneous" or "Other" or similar

Be intelligent about merchant names that include codes, abbreviations, or location info. Match to the closest category from the user's actual categories.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'AI service error',
          details: errorText
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const suggestedCategory = data.content[0].text.trim();

    const categoryMatch = categories.find(
      c => c.name.toLowerCase() === suggestedCategory.toLowerCase()
    );

    if (!categoryMatch) {
      console.error(`AI suggested "${suggestedCategory}" but no match found in user categories`);
      return new Response(
        JSON.stringify({
          error: 'Category not found',
          suggestion: suggestedCategory,
          details: 'The AI suggested a category that does not exist in your category list'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        category: categoryMatch.name,
        type: categoryMatch.type,
        confidence: 'ai',
      }),
      {
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