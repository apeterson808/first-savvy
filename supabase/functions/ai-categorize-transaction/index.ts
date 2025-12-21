import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface Category {
  name: string;
  type: 'income' | 'expense';
}

const CATEGORIES: Category[] = [
  { name: "Dining Out", type: "expense" },
  { name: "Education", type: "expense" },
  { name: "Family & Kids", type: "expense" },
  { name: "Financial", type: "expense" },
  { name: "Giving", type: "expense" },
  { name: "Groceries", type: "expense" },
  { name: "Health & Wellness", type: "expense" },
  { name: "Housing", type: "expense" },
  { name: "Insurance", type: "expense" },
  { name: "Miscellaneous", type: "expense" },
  { name: "Personal & Lifestyle", type: "expense" },
  { name: "Subscriptions", type: "expense" },
  { name: "Taxes", type: "expense" },
  { name: "Transportation", type: "expense" },
  { name: "Travel", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Gifts Received", type: "income" },
  { name: "Other Income", type: "income" },
  { name: "Salary", type: "income" },
];

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

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'AI service not configured',
          fallback: suggestCategoryFallback(description)
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const categoryList = CATEGORIES.map(c => `${c.name} (${c.type})`).join(', ');
    
    const prompt = `Analyze this transaction and suggest the most appropriate category from the list below.

Transaction description: "${description}"
Amount: ${amount || 'unknown'}

Available categories:
${categoryList}

Respond with ONLY the category name exactly as it appears in the list above. Do not include the type in parentheses. For example, respond with "Groceries" not "Groceries (expense)".

Category mapping guidelines:
- Grocery stores (Whole Foods, Trader Joe's, Safeway, Kroger, Costco, etc.) → Groceries
- Restaurants, cafes, food delivery (Starbucks, McDonald's, Chipotle, DoorDash, Uber Eats, etc.) → Dining Out
- Gas stations, car maintenance, public transit, rideshare (Shell, Chevron, Uber, Lyft, etc.) → Transportation
- Retail stores, online shopping, general merchandise (Amazon, Target, Walmart, Best Buy, etc.) → Personal & Lifestyle
- Streaming services, gym memberships, recurring software (Netflix, Spotify, Hulu, Apple, etc.) → Subscriptions
- Doctor, pharmacy, hospital, fitness, wellness (CVS, Walgreens, medical centers, etc.) → Health & Wellness
- Electric, water, gas, internet, phone bills (PG&E, AT&T, Verizon, Comcast, etc.) → Utilities
- Rent, mortgage, home repairs, property expenses → Housing
- Insurance premiums (auto, health, home, life) → Insurance
- Schools, courses, books, educational materials → Education
- Childcare, toys, kids activities, family expenses → Family & Kids
- Donations, charitable giving, gifts to others → Giving
- Movies, concerts, events, entertainment venues (AMC, theaters, etc.) → Personal & Lifestyle
- Flights, hotels, vacation expenses → Travel
- Bank fees, investment fees, debt payments, loan payments → Financial
- Tax payments, tax preparation → Taxes
- Paycheck, salary, direct deposit from employer → Salary
- Gift money received, bonuses, refunds → Gifts Received
- Any other income sources → Other Income
- Anything that doesn't fit well → Miscellaneous

Be intelligent about merchant names that include codes, abbreviations, or location info.`;

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
      console.error('Anthropic API error:', await response.text());
      return new Response(
        JSON.stringify({ 
          error: 'AI service error',
          fallback: suggestCategoryFallback(description)
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const suggestedCategory = data.content[0].text.trim();

    const categoryMatch = CATEGORIES.find(
      c => c.name.toLowerCase() === suggestedCategory.toLowerCase()
    );

    if (!categoryMatch) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid category suggested',
          fallback: suggestCategoryFallback(description)
        }),
        {
          status: 200,
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

function suggestCategoryFallback(description: string): { category: string; type: string; confidence: string } {
  const descLower = description.toLowerCase();

  const patterns = [
    { keywords: ['wholefds', 'whole foods', 'trader joe', 'safeway', 'kroger', 'albertsons', 'grocery', 'market'], category: 'Groceries', type: 'expense' },
    { keywords: ['starbucks', 'coffee', 'restaurant', 'cafe', 'doordash', 'uber eats', 'grubhub', 'mcdonald', 'chipotle', 'panera', 'olive garden', 'panda', 'cheesecake'], category: 'Dining Out', type: 'expense' },
    { keywords: ['shell', 'chevron', 'exxon', 'bp', 'gas', 'fuel', 'gasoline', 'uber', 'lyft', 'metro', 'transit', 'bus', 'train', 'parking'], category: 'Transportation', type: 'expense' },
    { keywords: ['amazon', 'target', 'walmart', 'costco', 'best buy', 'nordstrom', 'lululemon', 'shopping'], category: 'Personal & Lifestyle', type: 'expense' },
    { keywords: ['netflix', 'spotify', 'hulu', 'disney', 'prime', 'subscription', 'apple.com/bill'], category: 'Subscriptions', type: 'expense' },
    { keywords: ['pg&e', 'electric', 'water', 'gas company', 'internet', 'phone', 'utility', 'comcast', 'at&t', 'att', 'verizon'], category: 'Utilities', type: 'expense' },
    { keywords: ['rent payment', 'apartment', 'landlord', 'mortgage'], category: 'Housing', type: 'expense' },
    { keywords: ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'medical', 'health'], category: 'Health & Wellness', type: 'expense' },
    { keywords: ['insurance', 'geico', 'state farm', 'allstate'], category: 'Insurance', type: 'expense' },
    { keywords: ['school', 'tuition', 'education', 'course'], category: 'Education', type: 'expense' },
    { keywords: ['kid', 'child', 'daycare', 'toy'], category: 'Family & Kids', type: 'expense' },
    { keywords: ['donation', 'charity', 'gift'], category: 'Giving', type: 'expense' },
    { keywords: ['amc', 'theater', 'movie', 'concert'], category: 'Personal & Lifestyle', type: 'expense' },
    { keywords: ['flight', 'hotel', 'airbnb', 'travel', 'vacation'], category: 'Travel', type: 'expense' },
    { keywords: ['bank fee', 'atm', 'wire transfer', 'payment', 'credit card payment'], category: 'Financial', type: 'expense' },
    { keywords: ['tax', 'irs'], category: 'Taxes', type: 'expense' },
    { keywords: ['payroll', 'salary', 'direct deposit', 'paycheck'], category: 'Salary', type: 'income' },
    { keywords: ['interest', 'dividend', 'cashback', 'reward', 'deposit'], category: 'Other Income', type: 'income' },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => descLower.includes(keyword))) {
      return {
        category: pattern.category,
        type: pattern.type,
        confidence: 'pattern',
      };
    }
  }

  return {
    category: 'Miscellaneous',
    type: 'expense',
    confidence: 'fallback',
  };
}
