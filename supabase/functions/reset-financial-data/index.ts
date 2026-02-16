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

    // Call the database function to reset financial data
    // This bypasses all triggers and constraints
    console.log("Calling reset_financial_data_for_profile function...");
    const { data: resetResult, error: resetError } = await supabase.rpc(
      "reset_financial_data_for_profile",
      { p_profile_id: profileId }
    );

    if (resetError) {
      console.error("Error resetting financial data:", resetError);
      throw new Error(`Failed to reset financial data: ${resetError.message}`);
    }

    console.log("Reset result:", resetResult);

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

    const categoriesCount = resetResult?.preserved_categories || 0;
    const memoryCount = resetResult?.preserved_memories || 0;
    const rulesCount = resetResult?.preserved_rules || 0;

    console.log(`Successfully reset financial data for user ${userId}`);
    console.log(`Preserved: ${categoriesCount} categories, ${memoryCount} memories, ${rulesCount} rules`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Your financial data has been reset. ${categoriesCount} categories (income and expense), ${memoryCount} categorization memories, and ${rulesCount} transaction rules have been preserved.`,
        preserved_categories: categoriesCount,
        preserved_categorization_memories: memoryCount,
        preserved_transaction_rules: rulesCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error resetting financial data:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
