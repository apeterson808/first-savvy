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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { mappings } = await req.json();

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return new Response(
        JSON.stringify({ error: "mappings array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plaidApiUrl = PLAID_ENV === "production"
      ? "https://production.plaid.com"
      : PLAID_ENV === "development"
      ? "https://development.plaid.com"
      : "https://sandbox.plaid.com";

    const groupedByItem: Record<string, any[]> = {};
    for (const mapping of mappings) {
      const { item_id } = mapping;
      if (!groupedByItem[item_id]) {
        groupedByItem[item_id] = [];
      }
      groupedByItem[item_id].push(mapping);
    }

    let totalTransactionsImported = 0;

    for (const [itemId, itemMappings] of Object.entries(groupedByItem)) {
      const { data: plaidItem } = await supabaseClient
        .from("plaid_items")
        .select("*")
        .eq("item_id", itemId)
        .eq("user_id", user.id)
        .single();

      if (!plaidItem) {
        console.error(`Plaid item ${itemId} not found`);
        continue;
      }

      for (const mapping of itemMappings) {
        const { plaid_account_id, local_account_id, account_type, start_date, go_live_date } = mapping;

        const today = new Date().toISOString().split('T')[0];
        const startDate = start_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const goLiveDate = go_live_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetch(`${plaidApiUrl}/transactions/get`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
            "PLAID-SECRET": PLAID_SECRET,
          },
          body: JSON.stringify({
            access_token: plaidItem.access_token,
            start_date: startDate,
            end_date: today,
            options: {
              account_ids: [plaid_account_id],
              count: 500,
              offset: 0,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Plaid transactions fetch error:", data);
          continue;
        }

        const transactions = data.transactions || [];
        const transactionsToInsert = [];

        for (const txn of transactions) {
          const txnDate = txn.date;
          const isPending = txn.pending;
          const isPosted = new Date(txnDate) < new Date(goLiveDate);

          const accountId = account_type === 'credit_card' ? null : local_account_id;
          const creditCardId = account_type === 'credit_card' ? local_account_id : null;

          transactionsToInsert.push({
            user_id: user.id,
            account_id: accountId,
            date: txnDate,
            description: txn.merchant_name || txn.name || "Transaction",
            amount: -txn.amount,
            status: isPending ? "pending" : (isPosted ? "posted" : "pending"),
            type: txn.amount < 0 ? "income" : "expense",
            payment_method: account_type === 'credit_card' ? "credit_card" : "bank_transfer",
            plaid_transaction_id: txn.transaction_id,
            original_type: txn.amount < 0 ? "income" : "expense",
          });
        }

        if (transactionsToInsert.length > 0) {
          const { error: insertError } = await supabaseClient
            .from("transactions")
            .upsert(transactionsToInsert, {
              onConflict: "plaid_transaction_id",
              ignoreDuplicates: true,
            });

          if (insertError) {
            console.error("Transaction insert error:", insertError);
          } else {
            totalTransactionsImported += transactionsToInsert.length;
          }
        }
      }

      const { error: updateError } = await supabaseClient
        .from("plaid_items")
        .update({
          last_successful_update: new Date().toISOString(),
        })
        .eq("item_id", itemId);

      if (updateError) {
        console.error("Failed to update plaid_item:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactions_imported: totalTransactionsImported,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in plaid-import-transactions:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
