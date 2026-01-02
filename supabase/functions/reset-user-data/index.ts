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

    await supabase.from("transaction_splits").delete().eq("user_id", userId);
    await supabase.from("transactions").delete().eq("user_id", userId);
    await supabase.from("categorization_rules").delete().eq("user_id", userId);
    await supabase.from("contact_matching_rules").delete().eq("user_id", userId);
    await supabase.from("payment_reminders").delete().eq("user_id", userId);
    await supabase.from("transfer_registry").delete().eq("user_id", userId);
    await supabase.from("asset_liability_links").delete().eq("user_id", userId);
    await supabase.from("budgets").delete().eq("user_id", userId);
    await supabase.from("budget_groups").delete().eq("user_id", userId);
    await supabase.from("categories").delete().eq("user_id", userId);
    await supabase.from("accounts").delete().eq("user_id", userId);
    await supabase.from("bank_accounts").delete().eq("user_id", userId);
    await supabase.from("credit_cards").delete().eq("user_id", userId);
    await supabase.from("assets").delete().eq("user_id", userId);
    await supabase.from("liabilities").delete().eq("user_id", userId);
    await supabase.from("equity").delete().eq("user_id", userId);
    await supabase.from("contacts").delete().eq("user_id", userId);
    await supabase.from("bills").delete().eq("user_id", userId);
    await supabase.from("credit_scores").delete().eq("user_id", userId);
    await supabase.from("plaid_items").delete().eq("user_id", userId);
    await supabase.from("configuration_change_log").delete().eq("user_id", userId);
    await supabase.from("user_chart_of_accounts").delete().eq("user_id", userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const profileId = profile?.id;

    if (profileId) {
      const { data: templates } = await supabase
        .from("chart_of_accounts_templates")
        .select("*")
        .order("account_number");

      if (templates && templates.length > 0) {
        const userAccounts = templates.map(template => ({
          user_id: userId,
          profile_id: profileId,
          template_account_number: template.account_number,
          account_number: template.account_number,
          class: template.class,
          account_detail: template.account_detail,
          account_type: template.account_type,
          display_name: template.display_name,
          icon: template.icon,
          color: template.color,
          is_active: false,
          is_user_created: false,
        }));

        await supabase.from("user_chart_of_accounts").insert(userAccounts);
      }
    }

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