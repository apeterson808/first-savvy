import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
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

    const response = await fetch(`${plaidApiUrl}/link/token/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        client_name: "FirstSavvy",
        language: "en",
        country_codes: ["US"],
        user: {
          client_user_id: user_id,
        },
        products: ["transactions"],
        required_if_supported_products: ["auth"],
        optional_products: ["identity", "liabilities"],
        account_filters: {
          depository: {
            account_subtypes: ["checking", "savings"],
          },
          credit: {
            account_subtypes: ["credit card"],
          },
          loan: {
            account_subtypes: ["auto", "commercial", "construction", "consumer", "home equity", "loan", "mortgage", "overdraft", "line of credit", "student"],
          },
        },
        transactions: {
          days_requested: 730,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Plaid API error:", data);
      return new Response(
        JSON.stringify({ error: data.error_message || "Failed to create link token" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        link_token: data.link_token,
        expiration: data.expiration,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in plaid-create-link-token:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
