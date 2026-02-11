import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getPlaidBaseUrl(): string {
  const env = Deno.env.get("PLAID_ENV") || "production";
  const urls: Record<string, string> = {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  };
  return urls[env] || urls.sandbox;
}

const PLAID_TYPE_MAP: Record<string, { class: string; accountType: string }> = {
  depository_checking: { class: "asset", accountType: "Checking" },
  depository_savings: { class: "asset", accountType: "Savings" },
  depository_money_market: { class: "asset", accountType: "Money Market" },
  depository_cd: { class: "asset", accountType: "CD" },
  credit_credit_card: { class: "liability", accountType: "Credit Card" },
  loan_mortgage: { class: "liability", accountType: "Mortgage" },
  loan_auto: { class: "liability", accountType: "Auto Loan" },
  loan_student: { class: "liability", accountType: "Student Loan" },
  loan_personal: { class: "liability", accountType: "Personal Loan" },
  investment_brokerage: { class: "asset", accountType: "Brokerage" },
  investment_retirement: { class: "asset", accountType: "Retirement" },
};

function mapPlaidAccountType(plaidType: string, plaidSubtype: string | null): { class: string; accountType: string } {
  const key = `${plaidType}_${plaidSubtype || ""}`;
  if (PLAID_TYPE_MAP[key]) return PLAID_TYPE_MAP[key];

  if (plaidType === "depository") return { class: "asset", accountType: "Checking" };
  if (plaidType === "credit") return { class: "liability", accountType: "Credit Card" };
  if (plaidType === "loan") return { class: "liability", accountType: "Loan" };
  if (plaidType === "investment") return { class: "asset", accountType: "Investment" };

  return { class: "asset", accountType: "Other" };
}

function getNextAccountNumber(existingNumbers: number[], accountClass: string): number {
  const ranges: Record<string, number> = {
    asset: 1000,
    liability: 2000,
    equity: 3000,
    income: 4000,
    expense: 5000,
  };
  const base = ranges[accountClass] || 1000;
  const classNumbers = existingNumbers.filter((n) => n >= base && n < base + 1000);
  if (classNumbers.length === 0) return base + 100;
  return Math.max(...classNumbers) + 10;
}

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { public_token, institution, accounts: plaidAccounts, profileId } = await req.json();

    if (!public_token) {
      return new Response(
        JSON.stringify({ error: "public_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "profileId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = Deno.env.get("PLAID_CLIENT_ID");
    const secret = Deno.env.get("PLAID_SECRET");

    if (!clientId || !secret) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exchangeResponse = await fetch(
      `${getPlaidBaseUrl()}/item/public_token/exchange`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          secret: secret,
          public_token: public_token,
        }),
      }
    );

    const exchangeData = await exchangeResponse.json();

    if (!exchangeResponse.ok) {
      console.error("Plaid exchange error:", exchangeData);
      return new Response(
        JSON.stringify({
          error: "Failed to exchange public token",
          plaid_error: exchangeData.error_message || exchangeData.error_type,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token, item_id } = exchangeData;

    const { data: plaidItem, error: insertError } = await supabase
      .from("plaid_items")
      .insert({
        profile_id: profileId,
        access_token: access_token,
        item_id: item_id,
        institution_id: institution?.institution_id || null,
        institution_name: institution?.name || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting plaid_item:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store Plaid connection" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdAccounts: Array<{ id: string; name: string; plaid_account_id: string }> = [];

    if (plaidAccounts && plaidAccounts.length > 0) {
      const { data: existingAccounts } = await supabase
        .from("user_chart_of_accounts")
        .select("account_number")
        .eq("profile_id", profileId)
        .order("account_number");

      const existingNumbers = (existingAccounts || []).map((a: { account_number: number }) => a.account_number);

      for (const plaidAcct of plaidAccounts) {
        const { data: existing } = await supabase
          .from("user_chart_of_accounts")
          .select("id")
          .eq("profile_id", profileId)
          .eq("plaid_account_id", plaidAcct.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("user_chart_of_accounts")
            .update({
              plaid_item_id: plaidItem.id,
              institution_name: institution?.name || null,
              account_number_last4: plaidAcct.mask || null,
              official_name: plaidAcct.name || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          createdAccounts.push({
            id: existing.id,
            name: plaidAcct.name,
            plaid_account_id: plaidAcct.id,
          });
          continue;
        }

        const mapped = mapPlaidAccountType(plaidAcct.type, plaidAcct.subtype);
        const accountNumber = getNextAccountNumber(existingNumbers, mapped.class);
        existingNumbers.push(accountNumber);

        const displayName = plaidAcct.name || plaidAcct.official_name || `${institution?.name || "Bank"} ${mapped.accountType}`;

        const { data: newAccount, error: acctError } = await supabase
          .from("user_chart_of_accounts")
          .insert({
            profile_id: profileId,
            plaid_item_id: plaidItem.id,
            plaid_account_id: plaidAcct.id,
            account_number: accountNumber,
            display_name: displayName,
            class: mapped.class,
            account_type: mapped.accountType,
            institution_name: institution?.name || null,
            account_number_last4: plaidAcct.mask || null,
            official_name: plaidAcct.official_name || plaidAcct.name || null,
            is_active: true,
            is_user_created: false,
            current_balance: plaidAcct.balances?.current || 0,
            available_balance: plaidAcct.balances?.available || null,
          })
          .select("id")
          .single();

        if (acctError) {
          console.error(`Error creating account for ${plaidAcct.id}:`, acctError);
          continue;
        }

        createdAccounts.push({
          id: newAccount.id,
          name: displayName,
          plaid_account_id: plaidAcct.id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        plaid_item_id: plaidItem.id,
        item_id: item_id,
        accounts_linked: createdAccounts.length,
        accounts: createdAccounts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error exchanging public token:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
