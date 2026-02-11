import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getPlaidBaseUrl(): string {
  const env = Deno.env.get("PLAID_ENV") || "sandbox";
  const urls: Record<string, string> = {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  };
  return urls[env] || urls.sandbox;
}

async function testPlaidAPIConnection(clientId: string, secret: string): Promise<any> {
  try {
    const response = await fetch(`${getPlaidBaseUrl()}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        secret: secret,
        user: { client_user_id: "test-user-123" },
        client_name: "FirstSavvy Test",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      status_text: response.statusText,
      response_data: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      error_type: "network_error",
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = Deno.env.get("PLAID_SECRET");
    const env = Deno.env.get("PLAID_ENV");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: {
        plaid_env: env || "not set",
        plaid_base_url: getPlaidBaseUrl(),
        supabase_url: supabaseUrl || "not set",
      },
      credentials: {
        configured: !!(clientId && secret),
        has_client_id: !!clientId,
        has_secret: !!secret,
        client_id_length: clientId ? clientId.length : 0,
        secret_length: secret ? secret.length : 0,
        client_id_prefix: clientId ? clientId.substring(0, 8) + "..." : "N/A",
      },
    };

    if (clientId && secret) {
      diagnostics.api_test = await testPlaidAPIConnection(clientId, secret);

      if (diagnostics.api_test.success) {
        diagnostics.status = "✅ Plaid is fully configured and working!";
        diagnostics.link_token_created = true;
      } else {
        diagnostics.status = "❌ Plaid credentials are set but API call failed";
        diagnostics.link_token_created = false;

        if (diagnostics.api_test.response_data?.error_type === "INVALID_API_KEYS") {
          diagnostics.issue = "Your PLAID_CLIENT_ID or PLAID_SECRET appears to be invalid";
          diagnostics.recommendation = "Double-check your credentials in the Plaid Dashboard";
        } else if (diagnostics.api_test.response_data?.error_type) {
          diagnostics.issue = `Plaid API error: ${diagnostics.api_test.response_data.error_type}`;
          diagnostics.recommendation = diagnostics.api_test.response_data.error_message;
        }
      }
    } else {
      diagnostics.status = "❌ Plaid credentials not configured";
      diagnostics.issue = "Missing environment variables";
      diagnostics.recommendation = "Add PLAID_CLIENT_ID and PLAID_SECRET in Supabase Edge Function secrets";
      diagnostics.instructions = {
        step_1: "Sign up for Plaid at https://dashboard.plaid.com/signup",
        step_2: "Get your credentials from https://dashboard.plaid.com/developers/keys",
        step_3: "Add them in Supabase: Project Settings → Edge Functions → Secrets",
        variables_needed: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV (should be 'sandbox')"]
      };
    }

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      }, null, 2),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
