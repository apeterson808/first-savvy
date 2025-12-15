import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('firstsavvy');

interface Category {
  name: string;
  type: 'income' | 'expense';
}

const CATEGORIES: Category[] = [
  { name: "Groceries", type: "expense" },
  { name: "Dining Out", type: "expense" },
  { name: "Gas & Fuel", type: "expense" },
  { name: "Transportation", type: "expense" },
  { name: "Shopping", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Healthcare", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Mortgage", type: "expense" },
  { name: "Insurance", type: "expense" },
  { name: "Subscriptions", type: "expense" },
  { name: "Personal Care", type: "expense" },
  { name: "Clothing", type: "expense" },
  { name: "Education", type: "expense" },
  { name: "Gifts & Donations", type: "expense" },
  { name: "Home Improvement", type: "expense" },
  { name: "Travel", type: "expense" },
  { name: "Pets", type: "expense" },
  { name: "Kids", type: "expense" },
  { name: "Fees & Charges", type: "expense" },
  { name: "Debt Payments", type: "expense" },
  { name: "Taxes", type: "expense" },
  { name: "Other Expenses", type: "expense" },
  { name: "Salary", type: "income" },
  { name: "Business Income", type: "income" },
  { name: "Investment Income", type: "income" },
  { name: "Interest Earned", type: "income" },
  { name: "Rental Income", type: "income" },
  { name: "Other Income", type: "income" },
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

If the transaction appears to be from:
- Grocery stores (Whole Foods, Trader Joe's, Safeway, Kroger, etc.) → Groceries
- Restaurants, cafes, food delivery (Starbucks, McDonald's, DoorDash, etc.) → Dining Out
- Gas stations (Shell, Chevron, BP, etc.) → Gas & Fuel
- Public transit, rideshare (Uber, Lyft, metro, bus, etc.) → Transportation
- Retail stores (Amazon, Target, Walmart, etc.) → Shopping
- Streaming, movies, games, events → Entertainment
- Doctor, pharmacy, hospital → Healthcare
- Electric, water, gas, internet, phone bills → Utilities
- Rent payments → Rent
- Mortgage payments → Mortgage
- Insurance companies → Insurance
- Netflix, Spotify, gym memberships → Subscriptions
- Paycheck, direct deposit from employer → Salary

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
    { keywords: ['starbucks', 'coffee', 'restaurant', 'cafe', 'doordash', 'uber eats', 'grubhub', 'mcdonald', 'chipotle'], category: 'Dining Out', type: 'expense' },
    { keywords: ['shell', 'chevron', 'exxon', 'bp', 'gas', 'fuel', 'gasoline'], category: 'Gas & Fuel', type: 'expense' },
    { keywords: ['uber', 'lyft', 'metro', 'transit', 'bus', 'train', 'parking'], category: 'Transportation', type: 'expense' },
    { keywords: ['amazon', 'target', 'walmart', 'costco', 'shopping'], category: 'Shopping', type: 'expense' },
    { keywords: ['netflix', 'spotify', 'hulu', 'disney', 'prime', 'subscription'], category: 'Subscriptions', type: 'expense' },
    { keywords: ['electric', 'water', 'gas company', 'internet', 'phone', 'utility', 'comcast', 'att', 'verizon'], category: 'Utilities', type: 'expense' },
    { keywords: ['rent payment', 'apartment', 'landlord'], category: 'Rent', type: 'expense' },
    { keywords: ['mortgage', 'loan payment'], category: 'Mortgage', type: 'expense' },
    { keywords: ['doctor', 'pharmacy', 'cvs', 'walgreens', 'hospital', 'medical', 'health'], category: 'Healthcare', type: 'expense' },
    { keywords: ['insurance', 'geico', 'state farm', 'allstate'], category: 'Insurance', type: 'expense' },
    { keywords: ['payroll', 'salary', 'direct deposit', 'paycheck'], category: 'Salary', type: 'income' },
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
    category: 'Other Expenses',
    type: 'expense',
    confidence: 'fallback',
  };
}
