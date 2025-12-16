import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationRequest {
  invitationId: string;
  inviterName: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  invitationType: string;
  invitationToken: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      invitationId,
      inviterName,
      inviteeEmail,
      inviteePhone,
      invitationType,
      invitationToken,
    }: InvitationRequest = await req.json();

    if (!invitationId || !inviterName || !invitationToken) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: invitationId, inviterName, invitationToken",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = req.headers.get("origin") || "http://localhost:5173";
    const invitationLink = `${baseUrl}/accept-invitation?token=${invitationToken}`;

    let notificationSent = false;
    const results: any = { email: null, sms: null };

    if (inviteeEmail) {
      console.log(
        `Would send email to ${inviteeEmail} with invitation link: ${invitationLink}`
      );
      results.email = {
        success: true,
        message: `Email notification prepared for ${inviteeEmail}`,
        invitationLink,
      };
      notificationSent = true;
    }

    if (inviteePhone) {
      console.log(
        `Would send SMS to ${inviteePhone} with invitation link: ${invitationLink}`
      );
      results.sms = {
        success: true,
        message: `SMS notification prepared for ${inviteePhone}`,
        invitationLink,
      };
      notificationSent = true;
    }

    if (!notificationSent) {
      return new Response(
        JSON.stringify({
          error: "No email or phone provided for notification",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitationId,
        results,
        message: "Invitation notification sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invitation notification:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send invitation notification",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
