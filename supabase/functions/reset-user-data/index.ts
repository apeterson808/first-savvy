import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = user.id;

    await supabase.from("transactions").delete().eq("user_id", userId);
    await supabase.from("budget_items").delete().eq("user_id", userId);
    await supabase.from("budgets").delete().eq("user_id", userId);
    await supabase.from("categories").delete().eq("user_id", userId);
    await supabase.from("bank_accounts").delete().eq("user_id", userId);
    await supabase.from("credit_cards").delete().eq("user_id", userId);
    await supabase.from("contacts").delete().eq("user_id", userId);
    await supabase.from("equity_accounts").delete().eq("user_id", userId);
    await supabase.from("payment_reminders").delete().eq("user_id", userId);
    await supabase.from("categorization_rules").delete().eq("user_id", userId);
    await supabase.from("contact_matching_rules").delete().eq("user_id", userId);
    await supabase.from("service_connections").delete().eq("user_id", userId);
    await supabase.from("household_members").delete().eq("user_id", userId);
    await supabase.from("user_relationships").delete().eq("user_id", userId);
    await supabase.from("user_relationships").delete().eq("related_user_id", userId);
    await supabase.from("invitations").delete().eq("inviter_id", userId);
    await supabase.from("invitations").delete().eq("invitee_email", user.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "All user data has been cleared successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error resetting user data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});