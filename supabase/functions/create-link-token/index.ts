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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = Deno.env.get("PLAID_SECRET");

    if (!clientId || !secret) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const accessToken = body.access_token;

    const plaidPayload: Record<string, unknown> = {
      client_id: clientId,
      secret: secret,
      user: { client_user_id: user.id },
      client_name: "FirstSavvy",
      products: accessToken ? undefined : ["transactions"],
      country_codes: ["US"],
      language: "en",
      redirect_uri: body.redirect_uri || `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/plaid-oauth-redirect`,
      webhook: `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/plaid-webhook`,
    };

    console.log("Creating Plaid link token with payload:", {
      ...plaidPayload,
      secret: "[REDACTED]",
      client_id: clientId?.substring(0, 10) + "...",
    });

    if (accessToken) {
      plaidPayload.access_token = accessToken;
    }

    const plaidResponse = await fetch(
      `${getPlaidBaseUrl()}/link/token/create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plaidPayload),
      }
    );

    const plaidData = await plaidResponse.json();

    if (!plaidResponse.ok) {
      console.error("Plaid error:", plaidData);
      return new Response(
        JSON.stringify({
          error: "Failed to create link token",
          plaid_error: plaidData.error_message || plaidData.error_type,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ link_token: plaidData.link_token, expiration: plaidData.expiration }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating link token:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
