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

const aiCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

function extractMerchantCore(description: string): string {
  let merchant = description.toUpperCase().trim();
  merchant = merchant.replace(/\s*#\d+\s*/g, ' ');
  merchant = merchant.replace(/\s*CARD\s*\d+\s*/g, ' ');
  merchant = merchant.replace(/\s*X+\d+\s*/g, ' ');
  merchant = merchant.replace(/\s+\d{2}\/\d{2}\s*/g, ' ');
  merchant = merchant.replace(/\s*\d{4,}\s*/g, ' ');
  merchant = merchant.replace(/\s*POS\s*/gi, ' ');
  merchant = merchant.replace(/\s*DEBIT\s*/gi, ' ');
  merchant = merchant.replace(/\s*PURCHASE\s*/gi, ' ');

  const commonPrefixes = ['SQ *', 'SQ*', 'TST*', 'AMZN MKTP', 'AMZN', 'PP*', 'PAYPAL *'];
  for (const prefix of commonPrefixes) {
    if (merchant.startsWith(prefix)) {
      merchant = merchant.substring(prefix.length).trim();
      break;
    }
  }

  return merchant.replace(/\s+/g, ' ').trim();
}

function getCacheKey(description: string, userId: string): string {
  const merchantCore = extractMerchantCore(description);
  return `${userId}:${merchantCore}`;
}

function getCachedResult(cacheKey: string) {
  const cached = aiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }
  if (cached) {
    aiCache.delete(cacheKey);
  }
  return null;
}

function setCachedResult(cacheKey: string, result: any) {
  if (aiCache.size > 1000) {
    const oldestKey = aiCache.keys().next().value;
    aiCache.delete(oldestKey);
  }
  aiCache.set(cacheKey, { result, timestamp: Date.now() });
}

interface ChartAccount {
  id: string;
  account_number: number;
  class: string;
  account_type: string;
  account_detail?: string;
  display_name?: string;
}

async function categorizeWithClaude(
  description: string,
  amount: number | undefined,
  chartAccounts: ChartAccount[]
): Promise<{
  chartAccountId: string;
  accountNumber: number;
  category: string;
  type: string;
  reasoning: string;
} | null> {
  const accountsList = chartAccounts.map(acc => {
    const name = acc.display_name || acc.account_detail || acc.account_type;
    return `${acc.account_number} - ${name} (${acc.class})`;
  }).join('\n');

  const amountInfo = amount !== undefined
    ? `Transaction Amount: $${Math.abs(amount).toFixed(2)} (${amount >= 0 ? 'positive' : 'negative'})`
    : '';

  const prompt = `You are a financial transaction categorization expert. Analyze the following bank transaction description and categorize it into one of the provided chart of accounts.

Transaction Description: "${description}"
${amountInfo}

Available Chart of Accounts:
${accountsList}

Instructions:
1. Carefully read the transaction description to identify the merchant or purpose
2. Match it to the most appropriate category from the chart of accounts above
3. Consider the transaction amount and typical spending patterns
4. Return ONLY a valid JSON object with this exact structure:

{
  "accountNumber": <the account number>,
  "reasoning": "<brief 1-sentence explanation>"
}

Examples:
- "SQ *JOES COFFEE" should map to Dining Out
- "AMZN MKTP US" should map to Shopping
- "CHEVRON #1234" should map to Gas & Fuel
- "PAYCHECK ACME CORP" should map to Salary/Commission

Return only the JSON, no other text.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 256,
        temperature: 0.3,
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
      console.error('Anthropic API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      console.error('No content in Claude response');
      return null;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Claude response:', content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const matchedAccount = chartAccounts.find(
      acc => acc.account_number === parsed.accountNumber
    );

    if (!matchedAccount) {
      console.error('Account number not found:', parsed.accountNumber);
      return null;
    }

    return {
      chartAccountId: matchedAccount.id,
      accountNumber: matchedAccount.account_number,
      category: matchedAccount.display_name || matchedAccount.account_detail || matchedAccount.account_type,
      type: matchedAccount.class,
      reasoning: parsed.reasoning || 'AI categorization',
    };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return null;
  }
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

    if (ANTHROPIC_API_KEY) {
      try {
        const cacheKey = getCacheKey(description, user.id);
        const cachedResult = getCachedResult(cacheKey);

        if (cachedResult) {
          return new Response(
            JSON.stringify({
              ...cachedResult,
              confidence: 'ai-cached',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const aiResult = await categorizeWithClaude(description, amount, chartAccounts);
        if (aiResult) {
          const responseData = {
            chartAccountId: aiResult.chartAccountId,
            accountNumber: aiResult.accountNumber,
            category: aiResult.category,
            type: aiResult.type,
            confidence: 'ai',
            reasoning: aiResult.reasoning,
          };

          setCachedResult(cacheKey, responseData);

          return new Response(
            JSON.stringify(responseData),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (aiError) {
        console.error('Claude AI categorization failed:', aiError);
      }
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
