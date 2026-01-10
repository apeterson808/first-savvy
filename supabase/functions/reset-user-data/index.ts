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
    console.log(`Resetting data for user: ${userId}`);

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

    // Delete in correct order respecting foreign key constraints
    const tablesToDelete = [
      // Delete journal entries first (CASCADE will delete journal_entry_lines automatically)
      "journal_entries",
      "journal_entry_counters",

      // Delete transaction-related data (depends on accounts and contacts)
      "transaction_splits",
      "transactions",
      "transfer_registry",

      // Delete rules and budgets (depends on accounts and contacts)
      "categorization_rules",
      "contact_matching_rules",
      "budgets",

      // Delete contacts
      "contacts",

      // Delete accounts last (after all references are gone)
      "user_chart_of_accounts",

      // Delete profile-specific preferences
      "profile_view_preferences",
      "profile_tabs",
      "profile_memberships",
    ];

    let totalDeleted = 0;

    for (const table of tablesToDelete) {
      console.log(`Deleting from ${table} for profile ${profileId}...`);
      try {
        const { data, error } = await supabase
          .from(table)
          .delete()
          .eq("profile_id", profileId)
          .select();

        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          throw new Error(`Failed to delete from ${table}: ${error.message}`);
        }

        const deletedCount = data ? data.length : 0;
        totalDeleted += deletedCount;
        console.log(`Deleted ${deletedCount} rows from ${table}`);
      } catch (tableError) {
        console.error(`Exception deleting from ${table}:`, tableError);
        throw tableError;
      }
    }

    console.log(`Total rows deleted: ${totalDeleted}`);

    // Provision fresh chart of accounts and profile essentials
    console.log(`Provisioning fresh data for user ${userId}...`);

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
        profile_id: profileId,
        tab_name: "Personal",
        is_active: true,
      });

    if (tabError) {
      console.error("Error creating profile tab:", tabError);
      throw new Error(`Failed to create profile tab: ${tabError.message}`);
    }

    console.log(`Successfully reset and reprovisioned account for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your account has been reset successfully. All data deleted and fresh accounts created.",
        deleted_rows: totalDeleted
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