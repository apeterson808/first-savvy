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

    // Step 1: Null out every FK column with ON DELETE NO ACTION (restrict).
    // These block auth.users deletion unless cleared first.
    // Columns with ON DELETE CASCADE or SET NULL are handled automatically.
    const nullifyOps = [
      supabase.from("transactions").update({ last_modified_by_user_id: null }).eq("last_modified_by_user_id", userId),
      supabase.from("budgets").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("budgets").update({ last_modified_by_user_id: null }).eq("last_modified_by_user_id", userId),
      supabase.from("journal_entries").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("journal_entries").update({ edited_by: null }).eq("edited_by", userId),
      supabase.from("journal_entries").update({ posted_by: null }).eq("posted_by", userId),
      supabase.from("journal_entry_attachments").update({ uploaded_by: null }).eq("uploaded_by", userId),
      supabase.from("level_transition_history").update({ changed_by_user_id: null }).eq("changed_by_user_id", userId),
      supabase.from("tasks").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("tasks").update({ approved_by_user_id: null }).eq("approved_by_user_id", userId),
      supabase.from("rewards").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("reward_redemptions").update({ approved_by_user_id: null }).eq("approved_by_user_id", userId),
      supabase.from("reward_redemptions").update({ fulfilled_by_user_id: null }).eq("fulfilled_by_user_id", userId),
      supabase.from("allowance_schedules").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("child_transactions").update({ approved_by_user_id: null }).eq("approved_by_user_id", userId),
      supabase.from("chore_templates").update({ created_by_user_id: null }).eq("created_by_user_id", userId),
      supabase.from("task_completions").update({ reviewed_by: null }).eq("reviewed_by", userId),
    ];

    await Promise.allSettled(nullifyOps);
    console.log(`Nullified all FK references for user: ${userId}`);

    // Step 2: Remove non-owner household memberships, join requests, and any
    // contact records in other profiles that link back to this user.
    await supabase.from("profile_memberships").delete().eq("user_id", userId).neq("role", "owner");
    await supabase.from("household_join_requests").delete().eq("requester_user_id", userId);
    await supabase.from("contacts").delete().eq("linked_user_id", userId);

    // Step 3: Get all profiles belonging to this user.
    // Query profiles.user_id directly — profile_memberships may be out of sync.
    const { data: ownedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId);

    const profileIds = (ownedProfiles || []).map((p: any) => p.id);
    console.log(`Found ${profileIds.length} profiles for user`);

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
      "level_transition_history",
      "task_completions",
      "task_assignments",
      "chore_templates",
      "tasks",
      "rewards",
      "reward_redemptions",
      "child_transactions",
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
      "contact_groups",
      "csv_column_mapping_configs",
      "transaction_rules",
      "transfer_match_suggestions",
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

    // Step 5: Delete user-level rows
    await supabase.from("user_settings").delete().eq("id", userId);
    await supabase.from("audit_logs").delete().eq("user_id", userId);

    // Step 6: Delete the auth user — all FKs should be clear now
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
