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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    const { webhook_type, webhook_code, item_id } = payload;

    console.log(`Received webhook: ${webhook_type} - ${webhook_code} for item ${item_id}`);

    const { data: plaidItem } = await supabaseClient
      .from("plaid_items")
      .select("*")
      .eq("item_id", item_id)
      .single();

    if (!plaidItem) {
      console.log(`Item ${item_id} not found in database`);
      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    switch (webhook_type) {
      case "TRANSACTIONS":
        await handleTransactionsWebhook(supabaseClient, plaidItem, webhook_code);
        break;
      case "ITEM":
        await handleItemWebhook(supabaseClient, plaidItem, webhook_code);
        break;
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in plaid-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleTransactionsWebhook(
  supabaseClient: any,
  plaidItem: any,
  webhookCode: string
) {
  switch (webhookCode) {
    case "SYNC_UPDATES_AVAILABLE":
    case "DEFAULT_UPDATE":
    case "INITIAL_UPDATE":
    case "HISTORICAL_UPDATE":
      console.log(`Transactions available for item ${plaidItem.item_id}`);
      await supabaseClient
        .from("plaid_items")
        .update({
          sync_required: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plaidItem.id);
      break;
    case "TRANSACTIONS_REMOVED":
      console.log(`Transactions removed for item ${plaidItem.item_id}`);
      break;
    default:
      console.log(`Unhandled transaction webhook: ${webhookCode}`);
  }
}

async function handleItemWebhook(
  supabaseClient: any,
  plaidItem: any,
  webhookCode: string
) {
  switch (webhookCode) {
    case "ERROR":
      console.log(`Item error for ${plaidItem.item_id}`);
      await supabaseClient
        .from("plaid_items")
        .update({
          status: "error",
          error_message: "Item requires re-authentication",
          updated_at: new Date().toISOString(),
        })
        .eq("id", plaidItem.id);
      break;
    case "PENDING_EXPIRATION":
      console.log(`Item pending expiration: ${plaidItem.item_id}`);
      await supabaseClient
        .from("plaid_items")
        .update({
          status: "pending_expiration",
          error_message: "Item access will expire soon",
          updated_at: new Date().toISOString(),
        })
        .eq("id", plaidItem.id);
      break;
    case "USER_PERMISSION_REVOKED":
      console.log(`User revoked permission: ${plaidItem.item_id}`);
      await supabaseClient
        .from("plaid_items")
        .update({
          status: "revoked",
          error_message: "User revoked access",
          updated_at: new Date().toISOString(),
        })
        .eq("id", plaidItem.id);
      break;
    case "WEBHOOK_UPDATE_ACKNOWLEDGED":
      console.log(`Webhook update acknowledged: ${plaidItem.item_id}`);
      break;
    default:
      console.log(`Unhandled item webhook: ${webhookCode}`);
  }
}