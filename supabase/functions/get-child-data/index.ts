import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);

    // POST — submit a task completion
    if (req.method === "POST") {
      const { childId, taskId, starsEarned, note } = await req.json();

      if (!childId || !taskId) {
        return new Response(JSON.stringify({ error: "childId and taskId are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const record: Record<string, unknown> = {
        child_profile_id: childId,
        task_id: taskId,
        status: "pending",
        stars_earned: starsEarned ?? 1,
      };

      if (note && typeof note === "string" && note.trim()) {
        record.note = note.trim();
        record.submission_notes = note.trim();
      }

      const { error } = await supabase.from("task_completions").insert(record);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET — fetch all child data
    const childId = url.searchParams.get("childId");

    if (!childId) {
      return new Response(JSON.stringify({ error: "childId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [childRes, tasksRes, completionsRes, rewardsRes] = await Promise.all([
      supabase
        .from("child_profiles")
        .select("id, child_name, first_name, display_name, avatar_url, stars_balance, cash_balance, current_permission_level")
        .eq("id", childId)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, icon, color, star_reward, reset_mode, description")
        .eq("assigned_to_child_id", childId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_completions")
        .select("id, task_id, status, stars_earned, note, submission_notes")
        .eq("child_profile_id", childId)
        .gte("created_at", new Date(new Date().toLocaleDateString("en-CA")).toISOString()),
      supabase
        .from("rewards")
        .select("id, title, star_cost, image_url, icon, color, description, status")
        .eq("assigned_to_child_id", childId)
        .eq("is_active", true)
        .is("redeemed_at", null),
    ]);

    return new Response(
      JSON.stringify({
        child: childRes.data,
        tasks: tasksRes.data ?? [],
        completions: completionsRes.data ?? [],
        rewards: rewardsRes.data ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
