import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLAID_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

async function testPlaidEnv(clientId: string, secret: string, env: string): Promise<any> {
  const baseUrl = PLAID_URLS[env];
  if (!baseUrl) return { success: false, error: `Unknown env: ${env}` };

  try {
    const response = await fetch(`${baseUrl}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        secret: secret,
        user: { client_user_id: "test-diag-123" },
        client_name: "FirstSavvy Diagnostics",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    });

    const data = await response.json();

    return {
      env,
      url: baseUrl,
      success: response.ok,
      status: response.status,
      error_code: data.error_code || null,
      error_message: data.error_message || null,
      link_token_created: !!data.link_token,
    };
  } catch (error) {
    return {
      env,
      url: baseUrl,
      success: false,
      error: error.message,
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
    const configuredEnv = Deno.env.get("PLAID_ENV");

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      configured_env: configuredEnv || "NOT SET",
      credentials: {
        has_client_id: !!clientId,
        has_secret: !!secret,
        client_id_length: clientId ? clientId.length : 0,
        secret_length: secret ? secret.length : 0,
        client_id_prefix: clientId ? clientId.substring(0, 8) + "..." : "N/A",
      },
    };

    if (!clientId || !secret) {
      diagnostics.status = "MISSING_CREDENTIALS";
      diagnostics.fix = "Add PLAID_CLIENT_ID and PLAID_SECRET in Supabase: Project Settings > Edge Functions > Secrets";
    } else {
      const [sandbox, development, production] = await Promise.all([
        testPlaidEnv(clientId, secret, "sandbox"),
        testPlaidEnv(clientId, secret, "development"),
        testPlaidEnv(clientId, secret, "production"),
      ]);

      diagnostics.results = { sandbox, development, production };

      const working = [sandbox, development, production].filter((r) => r.success);
      if (working.length > 0) {
        diagnostics.status = "CREDENTIALS_VALID";
        diagnostics.working_environments = working.map((r) => r.env);
        diagnostics.recommendation = configuredEnv
          ? working.some((r) => r.env === configuredEnv)
            ? `PLAID_ENV=${configuredEnv} is correct and working`
            : `PLAID_ENV=${configuredEnv} does NOT work. Set PLAID_ENV to: ${working[0].env}`
          : `PLAID_ENV is not set. Add PLAID_ENV=${working[0].env} to your secrets`;
      } else {
        diagnostics.status = "CREDENTIALS_INVALID";
        diagnostics.fix = "Your PLAID_CLIENT_ID or PLAID_SECRET is wrong. Check https://dashboard.plaid.com/developers/keys";
      }
    }

    return new Response(JSON.stringify(diagnostics, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ status: "error", error: error.message, timestamp: new Date().toISOString() }, null, 2),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
