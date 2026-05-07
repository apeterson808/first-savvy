import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`Deleting account for user: ${userId}`);

    // Get all profiles owned by this user
    const { data: memberships } = await supabase
      .from("profile_memberships")
      .select("profile_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    const profileIds = (memberships || []).map((m: any) => m.profile_id);

    // Delete all profile-scoped data in FK-safe order
    const profileScopedTables = [
      "vault_items",
      "vault_folders",
      "vault_encryption_keys",
      "vault_shares",
      "meal_plan_entries",
      "meal_recipes",
      "calendar_events",
      "calendar_preferences",
      "task_completions",
      "task_assignments",
      "tasks",
      "rewards",
      "reward_redemptions",
      "child_profiles",
      "allowance_schedules",
      "profile_invitations",
      "profile_shares",
      "parent_access_grants",
      "journal_entry_lines",
      "journal_entries",
      "journal_entry_counters",
      "transaction_splits",
      "transactions",
      "budgets",
      "contacts",
      "csv_column_mapping_configs",
      "transaction_rules",
      "transfer_match_suggestions",
      "user_chart_of_accounts",
      "profile_view_preferences",
      "profile_tabs",
      "profile_memberships",
      "profiles",
    ];

    for (const profileId of profileIds) {
      for (const table of profileScopedTables) {
        try {
          await supabase.from(table).delete().eq("profile_id", profileId);
        } catch (_) {
          // Some tables may not have profile_id — skip silently
        }
      }
    }

    // Delete user-scoped data
    await supabase.from("user_settings").delete().eq("id", userId);
    await supabase.from("audit_logs").delete().eq("user_id", userId);

    // Finally delete the auth user itself
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    console.log(`Account fully deleted for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
