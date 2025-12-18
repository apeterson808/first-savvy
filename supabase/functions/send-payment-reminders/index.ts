import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentReminder {
  id: string;
  user_id: string;
  credit_card_id: string;
  reminder_date: string;
  due_date: string;
  amount: number;
  notification_type: string;
  credit_card: {
    name: string;
    current_balance: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    const { data: reminders, error: fetchError } = await supabase
      .from("payment_reminders")
      .select(`
        id,
        user_id,
        credit_card_id,
        reminder_date,
        due_date,
        amount,
        notification_type,
        credit_cards (
          name,
          current_balance
        )
      `)
      .eq("status", "pending")
      .lte("reminder_date", today)
      .gte("due_date", today);

    if (fetchError) {
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`);
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending reminders to send",
          remindersSent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = [];
    let sentCount = 0;

    for (const reminder of reminders) {
      const creditCard = Array.isArray(reminder.credit_cards)
        ? reminder.credit_cards[0]
        : reminder.credit_cards;

      const daysUntilDue = Math.ceil(
        (new Date(reminder.due_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const message = `Payment Reminder: Your ${creditCard?.name || "credit card"} payment of $${reminder.amount.toFixed(2)} is due in ${daysUntilDue} days (${reminder.due_date}). Current balance: $${(creditCard?.current_balance || 0).toFixed(2)}`;

      console.log(
        `[Payment Reminder] ${reminder.notification_type}: ${message}`
      );

      const { error: updateError } = await supabase
        .from("payment_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      if (updateError) {
        console.error(
          `Failed to update reminder ${reminder.id}: ${updateError.message}`
        );
        results.push({
          id: reminder.id,
          success: false,
          error: updateError.message,
        });
      } else {
        sentCount++;
        results.push({
          id: reminder.id,
          success: true,
          message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} payment reminders`,
        remindersSent: sentCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending payment reminders:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send payment reminders",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
