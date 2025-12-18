import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const { account_mappings, transactions_by_account } = await req.json();
    if (!account_mappings || !Array.isArray(account_mappings)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid account_mappings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountIdMap: Record<string, string> = {};
    const createdAccounts: any[] = [];
    let totalTransactions = 0;

    for (const mapping of account_mappings) {
      const { 
        plaid_account_id, 
        action, 
        existing_account_id,
        name,
        official_name,
        mask,
        type,
        balance,
        institution,
        account_type,
        detail_type,
        go_live_date,
        import_start_date
      } = mapping;

      if (action === 'create_new') {
        const isCreditCard = account_type === 'credit_card';
        const tableName = isCreditCard ? 'credit_cards' : 'bank_accounts';
        
        const accountData: any = {
          user_id: user.id,
          account_name: name || official_name,
          current_balance: balance,
          institution: institution,
          account_number: mask,
          plaid_account_id,
          is_active: true,
        };

        if (isCreditCard) {
          accountData.credit_limit = 0;
          accountData.apr = 0;
          accountData.last_synced_at = new Date().toISOString();
        } else {
          accountData.account_type = account_type || 'bank';
          accountData.detail_type = detail_type || 'checking';
          accountData.start_date = go_live_date || new Date().toISOString().split('T')[0];
        }

        const { data: newAccount, error: insertError } = await supabaseClient
          .from(tableName)
          .insert(accountData)
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating account:`, insertError);
          throw new Error(`Failed to create account: ${insertError.message}`);
        }

        accountIdMap[plaid_account_id] = newAccount.id;
        createdAccounts.push(newAccount);
      } else if (action === 'merge_existing' && existing_account_id) {
        accountIdMap[plaid_account_id] = existing_account_id;
        
        const { error: updateError } = await supabaseClient
          .from('bank_accounts')
          .update({ plaid_account_id })
          .eq('id', existing_account_id);

        if (updateError) {
          console.error(`Error updating account:`, updateError);
        }
      }
    }

    if (transactions_by_account) {
      for (const [plaid_account_id, transactions] of Object.entries(transactions_by_account)) {
        const accountId = accountIdMap[plaid_account_id];
        if (!accountId || !Array.isArray(transactions)) {
          continue;
        }

        const mapping = account_mappings.find(m => m.plaid_account_id === plaid_account_id);
        const goLiveDate = mapping?.go_live_date ? new Date(mapping.go_live_date) : new Date();

        for (const txn of transactions) {
          const { data: existingTxn } = await supabaseClient
            .from('transactions')
            .select('id')
            .eq('plaid_transaction_id', txn.plaid_transaction_id)
            .maybeSingle();

          if (existingTxn) {
            continue;
          }

          const txnDate = new Date(txn.date);
          const isHistorical = txnDate < goLiveDate;

          const transactionData = {
            user_id: user.id,
            account_id: accountId,
            date: txn.date,
            description: txn.description,
            merchant_name: txn.merchant_name || null,
            amount: Math.abs(txn.amount),
            transaction_type: txn.amount < 0 ? 'income' : 'expense',
            category: txn.category || 'Other Expenses',
            status: isHistorical ? 'posted' : 'pending',
            plaid_transaction_id: txn.plaid_transaction_id,
            is_pending: txn.pending || false,
          };

          const { error: txnError } = await supabaseClient
            .from('transactions')
            .insert(transactionData);

          if (txnError) {
            console.error(`Error inserting transaction:`, txnError);
          } else {
            totalTransactions++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        accounts_created: createdAccounts.length,
        transactions_imported: totalTransactions,
        accounts: createdAccounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error completing import:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to complete import',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});