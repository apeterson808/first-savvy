import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const { file_data } = await req.json();

    if (!file_data) {
      console.error('Missing file_data in request');
      return new Response(
        JSON.stringify({ status: "error", error: "file_data is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Received file_data, length:', file_data.length);

    let ofxContent: string;
    try {
      const binaryString = atob(file_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder('utf-8');
      ofxContent = decoder.decode(bytes);
      console.log('Decoded OFX content, length:', ofxContent.length);
    } catch (decodeError) {
      console.error('Error decoding base64:', decodeError);
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Invalid base64 data',
          details: decodeError.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transactions = [];
    let institutionName = "";
    let accountNumber = "";
    let beginningBalance = 0;

    const orgMatch = ofxContent.match(/<ORG>([^<]+)/i);
    if (orgMatch) institutionName = orgMatch[1].trim();

    const acctIdMatch = ofxContent.match(/<ACCTID>([^<]+)/i);
    if (acctIdMatch) accountNumber = acctIdMatch[1].trim();

    const balAmtMatch = ofxContent.match(/<BALAMT>([^<]+)/i);
    if (balAmtMatch) beginningBalance = parseFloat(balAmtMatch[1]);

    const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnPattern.exec(ofxContent)) !== null) {
      const txnBlock = match[1];

      const trnTypeMatch = txnBlock.match(/<TRNTYPE>([^<]+)/i);
      const dtPostedMatch = txnBlock.match(/<DTPOSTED>(\d{8})/i);
      const trnAmtMatch = txnBlock.match(/<TRNAMT>([^<]+)/i);
      const nameMatch = txnBlock.match(/<NAME>([^<]+)/i);
      const memoMatch = txnBlock.match(/<MEMO>([^<]+)/i);

      if (!dtPostedMatch || !trnAmtMatch) continue;

      const dateStr = dtPostedMatch[1];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = `${year}-${month}-${day}`;

      const amount = Math.abs(parseFloat(trnAmtMatch[1]));
      const isIncome = parseFloat(trnAmtMatch[1]) > 0;

      const description = (nameMatch?.[1] || memoMatch?.[1] || "Unknown Transaction").trim();

      transactions.push({
        date,
        description,
        original_description: description,
        amount,
        type: isIncome ? "income" : "expense",
      });
    }

    console.log('Parsed transactions:', transactions.length);

    return new Response(
      JSON.stringify({
        status: "success",
        output: {
          transactions,
          institutionName,
          accountNumber,
          beginningBalance,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error parsing OFX:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error.message,
        details: "Failed to parse OFX file",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
