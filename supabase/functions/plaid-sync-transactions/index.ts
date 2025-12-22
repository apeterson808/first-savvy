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

    const { item_id } = await req.json();

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

    const { data: plaidItem, error: itemError } = await supabaseClient
      .from("plaid_items")
      .select("*")
      .eq("item_id", item_id)
      .eq("user_id", user.id)
      .single();

    if (itemError || !plaidItem) {
      return new Response(
        JSON.stringify({ error: "Plaid item not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plaidApiUrl = PLAID_ENV === "production"
      ? "https://production.plaid.com"
      : PLAID_ENV === "development"
      ? "https://development.plaid.com"
      : "https://sandbox.plaid.com";

    const cursor = plaidItem.transactions_cursor || undefined;
    let hasMore = true;
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;
    let nextCursor = cursor;

    while (hasMore) {
      const response = await fetch(`${plaidApiUrl}/transactions/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
          "PLAID-SECRET": PLAID_SECRET,
        },
        body: JSON.stringify({
          access_token: plaidItem.access_token,
          cursor: nextCursor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Plaid sync error:", data);
        return new Response(
          JSON.stringify({ error: data.error_message || "Failed to sync transactions" }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { added, modified, removed, next_cursor, has_more } = data;

      for (const txn of added) {
        const { data: accounts } = await supabaseClient
          .from("accounts")
          .select("id, type")
          .eq("plaid_account_id", txn.account_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!accounts) continue;

        const accountId = accounts.type === "Credit Card" ? null : accounts.id;
        const creditCardId = accounts.type === "Credit Card" ? accounts.id : null;

        await supabaseClient
          .from("transactions")
          .upsert({
            user_id: user.id,
            account_id: accountId,
            credit_card_id: creditCardId,
            date: txn.date,
            description: txn.merchant_name || txn.name || "Transaction",
            amount: -txn.amount,
            status: txn.pending ? "pending" : "posted",
            type: txn.amount < 0 ? "income" : "expense",
            payment_method: creditCardId ? "credit_card" : "bank_transfer",
            plaid_transaction_id: txn.transaction_id,
            original_type: txn.amount < 0 ? "income" : "expense",
          }, {
            onConflict: "plaid_transaction_id",
          });

        addedCount++;
      }

      for (const txn of modified) {
        await supabaseClient
          .from("transactions")
          .update({
            date: txn.date,
            description: txn.merchant_name || txn.name || "Transaction",
            amount: -txn.amount,
            status: txn.pending ? "pending" : "posted",
          })
          .eq("plaid_transaction_id", txn.transaction_id);

        modifiedCount++;
      }

      for (const txn of removed) {
        await supabaseClient
          .from("transactions")
          .delete()
          .eq("plaid_transaction_id", txn.transaction_id);

        removedCount++;
      }

      nextCursor = next_cursor;
      hasMore = has_more;
    }

    await supabaseClient
      .from("plaid_items")
      .update({
        transactions_cursor: nextCursor,
        sync_required: false,
        last_successful_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", plaidItem.id);

    return new Response(
      JSON.stringify({
        success: true,
        added: addedCount,
        modified: modifiedCount,
        removed: removedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in plaid-sync-transactions:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});