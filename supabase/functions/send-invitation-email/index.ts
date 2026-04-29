import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLE_LABELS: Record<string, string> = {
  spouse_partner: "Spouse / Partner",
  parent: "Parent",
  sibling: "Sibling",
  grandparent: "Grandparent",
  other: "Family Member",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invitationToken, invitedEmail, inviterName, familyRole, appUrl } = await req.json();

    if (!invitationToken || !invitedEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleLabel = ROLE_LABELS[familyRole] || "Family Member";
    const acceptUrl = `${appUrl || "https://lfisuvkmkwsublkiyimv.supabase.co"}/claim?token=${invitationToken}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to First Savvy</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">FIRST SAVVY</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Family Invitation</p>
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.2;">
                ${inviterName ? `${inviterName} invited you` : "You've been invited"} to join their family finances
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.6;">
                You've been added as a <strong>${roleLabel}</strong> on First Savvy. Once you accept, you'll have shared access to your combined financial picture.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;border-radius:8px;margin:0 0 32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">What you'll get</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:14px;color:#334155;">&#10003;&nbsp; View shared accounts, budgets &amp; transactions</td></tr>
                      <tr><td style="padding:4px 0;font-size:14px;color:#334155;">&#10003;&nbsp; Full access to net worth &amp; financial goals</td></tr>
                      <tr><td style="padding:4px 0;font-size:14px;color:#334155;">&#10003;&nbsp; Your own login and personal profile</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${acceptUrl}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.2px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
                This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                First Savvy &mdash; Family Finance Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return new Response(
      JSON.stringify({ success: false, reason: "Email sending is not configured." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
