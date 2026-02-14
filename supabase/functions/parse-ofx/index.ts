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
    const requestBody = await req.json();
    console.log('Request body keys:', Object.keys(requestBody));
    
    let file_data: string;
    let file_name = 'unknown.ofx';
    
    if (requestBody.body) {
      console.log('Unwrapping body property');
      file_data = requestBody.body.file_data;
      file_name = requestBody.body.file_name || file_name;
    } else {
      file_data = requestBody.file_data;
      file_name = requestBody.file_name || file_name;
    }

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

    console.log(`Processing OFX: ${file_name}, data length: ${file_data.length}`);

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
    let endingBalance = 0;
    let statementStartDate = null;
    let statementEndDate = null;
    let accountType = "checking";

    const orgMatch = ofxContent.match(/<ORG>([^<]+)/i);
    if (orgMatch) institutionName = orgMatch[1].trim();

    const acctIdMatch = ofxContent.match(/<ACCTID>([^<]+)/i);
    if (acctIdMatch) accountNumber = acctIdMatch[1].trim();

    const isCreditCard = ofxContent.includes('<CREDITCARDMSGSRSV1>') ||
                        ofxContent.includes('<CCSTMTTRNRS>') ||
                        ofxContent.match(/<ACCTTYPE>CREDITLINE/i);

    if (isCreditCard) {
      accountType = "credit_card";
    }

    const dtStartMatch = ofxContent.match(/<DTSTART>(\d{8})/i);
    if (dtStartMatch) {
      const dateStr = dtStartMatch[1];
      statementStartDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }

    const dtEndMatch = ofxContent.match(/<DTEND>(\d{8})/i);
    if (dtEndMatch) {
      const dateStr = dtEndMatch[1];
      statementEndDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }

    const balAmtMatch = ofxContent.match(/<BALAMT>([^<]+)/i);
    if (balAmtMatch) {
      endingBalance = parseFloat(balAmtMatch[1]);
      if (isCreditCard && endingBalance < 0) {
        endingBalance = Math.abs(endingBalance);
      }
    }

    const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnPattern.exec(ofxContent)) !== null) {
      const txnBlock = match[1];

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

    if (endingBalance !== 0 && transactions.length > 0) {
      beginningBalance = endingBalance;
      for (const txn of transactions) {
        if (isCreditCard) {
          if (txn.type === 'income') {
            beginningBalance += txn.amount;
          } else {
            beginningBalance -= txn.amount;
          }
        } else {
          if (txn.type === 'income') {
            beginningBalance -= txn.amount;
          } else {
            beginningBalance += txn.amount;
          }
        }
      }
    } else if (endingBalance !== 0) {
      beginningBalance = endingBalance;
    }

    console.log('Account type:', isCreditCard ? 'Credit Card' : 'Bank Account');
    console.log('Parsed transactions:', transactions.length);
    console.log('Beginning balance:', beginningBalance, 'Ending balance:', endingBalance);

    return new Response(
      JSON.stringify({
        status: "success",
        output: {
          transactions,
          institutionName,
          accountNumber,
          beginningBalance,
          endingBalance,
          statementStartDate,
          statementEndDate,
          accountType,
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
