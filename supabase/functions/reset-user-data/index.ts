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

    const tablesToDelete = [
      "transaction_splits",
      "transaction_rules",
      "journal_entry_lines",
      "journal_entries",
      "transactions",
      "budgets",
      "contacts",
      "categorization_rules",
      "contact_matching_rules",
      "transfer_registry",
      "profile_tabs",
      "user_chart_of_accounts"
    ];

    for (const table of tablesToDelete) {
      console.log(`Attempting to delete from ${table} for profile ${profileId}...`);
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
        console.log(`Successfully deleted ${deletedCount} rows from ${table}`);
      } catch (tableError) {
        console.error(`Exception deleting from ${table}:`, tableError);
        throw tableError;
      }
    }

    console.log(`Provisioning fresh chart of accounts for user ${userId}...`);
    const { error: provisionError } = await supabase.rpc(
      "provision_chart_of_accounts_for_user",
      { p_user_id: userId }
    );

    if (provisionError) {
      console.error("Error provisioning chart of accounts:", provisionError);
      throw new Error(`Failed to provision chart of accounts: ${provisionError.message}`);
    }

    console.log(`Successfully provisioned Income and Expense accounts for new user experience`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your account has been reset to a fresh start with Income and Expense categories ready for budgeting"
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