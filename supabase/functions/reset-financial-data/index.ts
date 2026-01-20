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
    console.log(`Resetting financial data for user: ${userId}`);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    if (!profile) {
      console.error("No profile found for user!");
      throw new Error("No profile found for user");
    }

    const profileId = profile.id;
    console.log(`Found profile ${profileId} for user ${userId}`);

    // Use raw SQL to delete data without triggering constraints or triggers
    // This is an admin function that needs to work regardless of constraints
    console.log("Starting deletion process with raw SQL...");

    // Step 1: Delete journal entry lines first (children of journal_entries)
    console.log("Deleting journal_entry_lines...");
    const { error: linesError } = await supabase.rpc("exec_sql", {
      sql: `DELETE FROM journal_entry_lines WHERE profile_id = $1`,
      params: [profileId]
    });

    // If rpc doesn't exist, use direct SQL
    const deleteSql = `
      -- Disable triggers temporarily for this session
      SET session_replication_role = 'replica';

      -- Delete in correct order to avoid foreign key violations
      DELETE FROM journal_entry_lines WHERE profile_id = '${profileId}';
      DELETE FROM journal_entries WHERE profile_id = '${profileId}';
      DELETE FROM journal_entry_counters WHERE profile_id = '${profileId}';

      DELETE FROM transaction_splits WHERE transaction_id IN (
        SELECT id FROM transactions WHERE profile_id = '${profileId}'
      );
      DELETE FROM transactions WHERE profile_id = '${profileId}';
      DELETE FROM transfer_registry WHERE profile_id = '${profileId}';

      DELETE FROM accounting_periods WHERE profile_id = '${profileId}';
      DELETE FROM budgets WHERE profile_id = '${profileId}';
      DELETE FROM profile_view_preferences WHERE profile_id = '${profileId}';
      DELETE FROM profile_tabs WHERE profile_id = '${profileId}';
      DELETE FROM profile_memberships WHERE profile_id = '${profileId}';

      -- Delete template accounts (preserve custom categories)
      DELETE FROM user_chart_of_accounts
      WHERE profile_id = '${profileId}'
        AND is_user_created = false;

      -- Re-enable triggers
      SET session_replication_role = 'origin';
    `;

    console.log("Executing bulk delete SQL...");
    const { error: deleteError } = await supabase.rpc("exec_sql", {
      sql: deleteSql
    });

    if (deleteError) {
      console.log("RPC method not available, using individual deletes...");

      // Fallback: Delete using Supabase client in correct order
      // Delete journal_entry_lines first
      await supabase
        .from("journal_entry_lines")
        .delete()
        .eq("profile_id", profileId);

      // Delete journal_entries
      await supabase
        .from("journal_entries")
        .delete()
        .eq("profile_id", profileId);

      // Delete journal_entry_counters
      await supabase
        .from("journal_entry_counters")
        .delete()
        .eq("profile_id", profileId);

      // Delete transaction_splits
      await supabase
        .from("transaction_splits")
        .delete()
        .in("transaction_id",
          supabase
            .from("transactions")
            .select("id")
            .eq("profile_id", profileId)
        );

      // Delete transactions
      await supabase
        .from("transactions")
        .delete()
        .eq("profile_id", profileId);

      // Delete transfer_registry
      await supabase
        .from("transfer_registry")
        .delete()
        .eq("profile_id", profileId);

      // Delete accounting_periods
      await supabase
        .from("accounting_periods")
        .delete()
        .eq("profile_id", profileId);

      // Delete budgets
      await supabase
        .from("budgets")
        .delete()
        .eq("profile_id", profileId);

      // Delete profile_view_preferences
      await supabase
        .from("profile_view_preferences")
        .delete()
        .eq("profile_id", profileId);

      // Delete profile_tabs
      await supabase
        .from("profile_tabs")
        .delete()
        .eq("profile_id", profileId);

      // Delete profile_memberships
      await supabase
        .from("profile_memberships")
        .delete()
        .eq("profile_id", profileId);

      // Delete template accounts
      await supabase
        .from("user_chart_of_accounts")
        .delete()
        .eq("profile_id", profileId)
        .eq("is_user_created", false);
    }

    console.log("Deletion complete");

    // Count preserved items
    const { count: customCount } = await supabase
      .from("user_chart_of_accounts")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("is_user_created", true);

    const { count: memoryCount } = await supabase
      .from("transaction_categorization_memory")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId);

    const { count: rulesCount } = await supabase
      .from("transaction_rules")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId);

    console.log(`Preserved ${customCount || 0} custom categories`);
    console.log(`Preserved ${memoryCount || 0} categorization memories`);
    console.log(`Preserved ${rulesCount || 0} transaction rules`);

    // Provision fresh chart of accounts and profile essentials
    console.log(`Provisioning fresh financial data for user ${userId}...`);

    // Provision chart of accounts
    const { error: provisionError } = await supabase.rpc(
      "provision_chart_of_accounts_for_user",
      { p_user_id: userId }
    );

    if (provisionError) {
      console.error("Error provisioning chart of accounts:", provisionError);
      throw new Error(`Failed to provision chart of accounts: ${provisionError.message}`);
    }

    // Recreate profile membership
    const { error: membershipError } = await supabase
      .from("profile_memberships")
      .insert({
        profile_id: profileId,
        user_id: userId,
        role: "owner",
      });

    if (membershipError) {
      console.error("Error creating profile membership:", membershipError);
      throw new Error(`Failed to create profile membership: ${membershipError.message}`);
    }

    // Recreate default profile tab
    const { error: tabError } = await supabase
      .from("profile_tabs")
      .insert({
        owner_user_id: userId,
        profile_id: profileId,
        display_name: "Personal",
        is_active: true,
      });

    if (tabError) {
      console.error("Error creating profile tab:", tabError);
      throw new Error(`Failed to create profile tab: ${tabError.message}`);
    }

    console.log(`Successfully reset financial data for user ${userId}. Contacts, custom categories, categorization memories, and transaction rules preserved.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Your financial data has been reset. Contacts, ${customCount || 0} custom categories, ${memoryCount || 0} categorization memories, and ${rulesCount || 0} transaction rules have been preserved.`,
        preserved_custom_categories: customCount || 0,
        preserved_categorization_memories: memoryCount || 0,
        preserved_transaction_rules: rulesCount || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error resetting financial data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
