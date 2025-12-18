import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "npm:plaid@29.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { public_token, selected_account_ids } = await req.json();
    if (!public_token) {
      return new Response(
        JSON.stringify({ error: 'Missing public_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Plaid credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const access_token = exchangeResponse.data.access_token;
    const item_id = exchangeResponse.data.item_id;

    const accountsResponse = await plaidClient.accountsGet({ access_token });
    const accounts = accountsResponse.data.accounts;
    const item = accountsResponse.data.item;

    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: item.institution_id!,
      country_codes: [CountryCode.Us],
    });
    const institution = institutionResponse.data.institution;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    const transactions = transactionsResponse.data.transactions;

    const { error: insertError } = await supabaseClient
      .from('plaid_items')
      .upsert({
        user_id: user.id,
        item_id,
        access_token,
        institution_id: item.institution_id!,
        institution_name: institution.name,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'item_id' });

    if (insertError) {
      console.error('Error storing Plaid item:', insertError);
    }

    const discovered_accounts = accounts.map((account) => ({
      plaid_account_id: account.account_id,
      name: account.name,
      official_name: account.official_name || account.name,
      mask: account.mask || '',
      type: account.subtype || account.type,
      balance: account.balances.current || 0,
      available_balance: account.balances.available,
      currency: account.balances.iso_currency_code || 'USD',
      institution: institution.name,
    }));

    const transactions_by_account: Record<string, any[]> = {};
    transactions.forEach((txn) => {
      if (!transactions_by_account[txn.account_id]) {
        transactions_by_account[txn.account_id] = [];
      }
      transactions_by_account[txn.account_id].push({
        plaid_transaction_id: txn.transaction_id,
        date: txn.date,
        description: txn.name,
        merchant_name: txn.merchant_name,
        amount: txn.amount,
        category: txn.category?.[0] || 'Other',
        pending: txn.pending,
      });
    });

    return new Response(
      JSON.stringify({
        discovered_accounts,
        transactions_by_account,
        item_id,
        institution_name: institution.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error exchanging token:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to exchange token',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});