import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = Deno.env.get("PLAID_SECRET");
    const env = Deno.env.get("PLAID_ENV");

    const result = {
      configured: !!(clientId && secret),
      has_client_id: !!clientId,
      has_secret: !!secret,
      environment: env || "not set",
      client_id_length: clientId ? clientId.length : 0,
      secret_length: secret ? secret.length : 0,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
