import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getPlaidBaseUrl(): string {
  const env = Deno.env.get("PLAID_ENV") || "sandbox";
  const urls: Record<string, string> = {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  };
  return urls[env] || urls.sandbox;
}

interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  pending: boolean;
  payment_channel: string;
  personal_finance_category?: {
    primary: string;
    detailed: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { plaid_item_id } = await req.json();

    if (!plaid_item_id) {
      return new Response(
        JSON.stringify({ error: "plaid_item_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: plaidItem, error: itemError } = await supabase
      .from("plaid_items")
      .select("*")
      .eq("id", plaid_item_id)
      .maybeSingle();

    if (itemError || !plaidItem) {
      return new Response(
        JSON.stringify({ error: "Plaid item not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: linkedAccounts } = await supabase
      .from("user_chart_of_accounts")
      .select("id, plaid_account_id")
      .eq("plaid_item_id", plaid_item_id);

    const accountMap = new Map<string, string>();
    (linkedAccounts || []).forEach((a: { id: string; plaid_account_id: string }) => {
      if (a.plaid_account_id) {
        accountMap.set(a.plaid_account_id, a.id);
      }
    });

    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = Deno.env.get("PLAID_SECRET");

    if (!clientId || !secret) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cursor = plaidItem.transactions_cursor || undefined;
    let hasMore = true;
    let added: PlaidTransaction[] = [];
    let modified: PlaidTransaction[] = [];
    let removed: Array<{ transaction_id: string }> = [];

    while (hasMore) {
      const syncPayload: Record<string, unknown> = {
        client_id: clientId,
        secret: secret,
        access_token: plaidItem.access_token,
        options: { include_personal_finance_category: true },
      };

      if (cursor) {
        syncPayload.cursor = cursor;
      }

      const syncResponse = await fetch(
        `${getPlaidBaseUrl()}/transactions/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncPayload),
        }
      );

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        console.error("Plaid sync error:", syncData);

        if (syncData.error_code) {
          await supabase
            .from("plaid_items")
            .update({
              error_code: syncData.error_code,
              error_message: syncData.error_message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", plaid_item_id);
        }

        return new Response(
          JSON.stringify({
            error: "Failed to sync transactions from Plaid",
            plaid_error: syncData.error_message || syncData.error_type,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      added = added.concat(syncData.added || []);
      modified = modified.concat(syncData.modified || []);
      removed = removed.concat(syncData.removed || []);
      hasMore = syncData.has_more;
      cursor = syncData.next_cursor;
    }

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    if (added.length > 0) {
      const inserts = added
        .map((txn: PlaidTransaction) => {
          const bankAccountId = accountMap.get(txn.account_id);
          if (!bankAccountId) return null;

          return {
            profile_id: plaidItem.profile_id,
            bank_account_id: bankAccountId,
            plaid_transaction_id: txn.transaction_id,
            date: txn.date,
            description: txn.merchant_name || txn.name,
            original_description: txn.name,
            amount: txn.amount,
            type: txn.amount > 0 ? "debit" : "credit",
            original_type: txn.amount > 0 ? "debit" : "credit",
            status: txn.pending ? "pending" : "posted",
            source: "plaid",
            payment_method: txn.payment_channel || null,
          };
        })
        .filter(Boolean);

      if (inserts.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < inserts.length; i += batchSize) {
          const batch = inserts.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from("transactions")
            .upsert(batch as Record<string, unknown>[], {
              onConflict: "plaid_transaction_id",
              ignoreDuplicates: true,
            });

          if (insertError) {
            console.error("Error inserting transactions batch:", insertError);
          } else {
            addedCount += batch.length;
          }
        }
      }
    }

    if (modified.length > 0) {
      for (const txn of modified) {
        const bankAccountId = accountMap.get(txn.account_id);
        if (!bankAccountId) continue;

        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            date: txn.date,
            description: txn.merchant_name || txn.name,
            original_description: txn.name,
            amount: txn.amount,
            type: txn.amount > 0 ? "debit" : "credit",
            status: txn.pending ? "pending" : "posted",
            payment_method: txn.payment_channel || null,
            updated_at: new Date().toISOString(),
          })
          .eq("plaid_transaction_id", txn.transaction_id)
          .eq("profile_id", plaidItem.profile_id);

        if (!updateError) modifiedCount++;
      }
    }

    if (removed.length > 0) {
      const removedIds = removed.map((r) => r.transaction_id);
      const batchSize = 100;
      for (let i = 0; i < removedIds.length; i += batchSize) {
        const batch = removedIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from("transactions")
          .update({ status: "excluded" })
          .in("plaid_transaction_id", batch)
          .eq("profile_id", plaidItem.profile_id);

        if (!deleteError) removedCount += batch.length;
      }
    }

    await supabase
      .from("plaid_items")
      .update({
        transactions_cursor: cursor,
        last_synced_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plaid_item_id);

    if (linkedAccounts && linkedAccounts.length > 0) {
      const accountIds = linkedAccounts.map((a: { id: string }) => a.id);
      await supabase
        .from("user_chart_of_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .in("id", accountIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: addedCount,
        modified: modifiedCount,
        removed: removedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
