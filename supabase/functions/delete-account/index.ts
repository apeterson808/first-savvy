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

    // Step 1: Null out every FK reference to this user across ALL tables.
    // Must happen BEFORE deleting owned data and BEFORE deleting the auth user,
    // because these columns may point at rows in other users' profiles.
    const nullifyOps = [
      supabase.from("transactions").update({ last_modified_by_user_id: null }).eq("last_modified_by_user_id", userId),
      supabase.from("journal_entries").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("journal_entries").update({ posted_by: null }).eq("posted_by", userId),
      supabase.from("journal_entry_attachments").update({ uploaded_by: null }).eq("uploaded_by", userId),
      supabase.from("budgets").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("budgets").update({ last_modified_by_user_id: null }).eq("last_modified_by_user_id", userId),
      supabase.from("task_completions").update({ reviewed_by: null }).eq("reviewed_by", userId),
      supabase.from("reward_redemptions").update({ approved_by_user_id: null }).eq("approved_by_user_id", userId),
      supabase.from("reward_redemptions").update({ fulfilled_by_user_id: null }).eq("fulfilled_by_user_id", userId),
      supabase.from("rewards").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("allowance_schedules").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("vault_items").update({ user_id: null }).eq("user_id", userId),
      supabase.from("vault_shares").update({ shared_by_user_id: null }).eq("shared_by_user_id", userId),
      supabase.from("vault_shares").update({ shared_with_user_id: null }).eq("shared_with_user_id", userId),
      supabase.from("household_join_requests").update({ requester_user_id: null }).eq("requester_user_id", userId),
      supabase.from("transaction_match_history").update({ decided_by: null }).eq("decided_by", userId),
      supabase.from("transfer_match_history").update({ decided_by: null }).eq("decided_by", userId),
      supabase.from("cc_payment_match_history").update({ decided_by: null }).eq("decided_by", userId),
    ];

    // Run all nullify ops, ignoring errors for tables that may not exist
    await Promise.allSettled(nullifyOps);

    // Step 2: Remove this user from any household memberships they belong to (non-owner)
    await supabase.from("profile_memberships").delete().eq("user_id", userId).neq("role", "owner");
    await supabase.from("household_join_requests").delete().eq("requester_user_id", userId);

    // Step 3: Get all profiles owned by this user
    const { data: memberships } = await supabase
      .from("profile_memberships")
      .select("profile_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    const profileIds = (memberships || []).map((m: any) => m.profile_id);

    // Step 4: Delete all profile-scoped data in FK-safe order
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
      "journal_entry_attachments",
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
      "transfer_match_history",
      "cc_payment_match_history",
      "transaction_match_history",
      "transfer_registry",
      "transfer_patterns",
      "credit_card_payment_registry",
      "credit_card_payment_patterns",
      "transaction_categorization_memory",
      "household_join_requests",
      "user_chart_of_accounts",
      "profile_view_preferences",
      "profile_tabs",
      "audit_logs",
      "profile_memberships",
      "profiles",
    ];

    for (const profileId of profileIds) {
      for (const table of profileScopedTables) {
        try {
          await supabase.from(table).delete().eq("profile_id", profileId);
        } catch (_) {
          // Table may not have profile_id — skip silently
        }
      }
    }

    // Step 5: Delete user-level data
    await supabase.from("user_settings").delete().eq("id", userId);
    await supabase.from("audit_logs").delete().eq("user_id", userId);

    // Step 6: Delete the auth user itself
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
