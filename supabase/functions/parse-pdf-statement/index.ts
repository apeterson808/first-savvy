import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: string;
  original_description: string;
  post_date?: string;
}

function parseCitiCostcoStatement(fullText: string): {
  transactions: Transaction[];
  institutionName: string;
  accountNumber: string;
  endingBalance?: number;
  beginningBalance?: number;
  statementStartDate?: string;
  statementEndDate?: string;
} {
  const transactions: Transaction[] = [];
  const institutionName = "Citi - Costco Anywhere Visa";
  let accountNumber = "";
  let endingBalance: number | undefined;
  let beginningBalance: number | undefined;
  let statementStartDate: string | undefined;
  let statementEndDate: string | undefined;

  const accountMatch = fullText.match(/Account number ending in[:\s]+(\d+)/i) ||
                       fullText.match(/Card ending in[:\s]+(\d+)/i);
  if (accountMatch) {
    accountNumber = accountMatch[1];
  }

  const previousBalanceMatch = fullText.match(/Previous balance[:\s]+\$([0-9,]+\.\d{2})/i);
  if (previousBalanceMatch) {
    beginningBalance = parseFloat(previousBalanceMatch[1].replace(/,/g, ''));
  }

  const balanceMatch = fullText.match(/New balance.*?\$([0-9,]+\.\d{2})/i);
  if (balanceMatch) {
    endingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
  }

  const billingPeriodMatch = fullText.match(/Billing Period:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})-(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  let currentYear = new Date().getFullYear();
  if (billingPeriodMatch) {
    const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = billingPeriodMatch;

    const parseYear = (yearStr: string) => {
      const year = parseInt(yearStr);
      return year >= 50 && year < 100 ? 1900 + year : year < 100 ? 2000 + year : year;
    };

    const fullStartYear = parseYear(startYear);
    const fullEndYear = parseYear(endYear);

    statementStartDate = `${fullStartYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
    statementEndDate = `${fullEndYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;

    currentYear = fullEndYear;
  }

  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let inPaymentsSection = false;
  let inPurchasesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Payments, Credits and Adjustments')) {
      inPaymentsSection = true;
      inPurchasesSection = false;
      continue;
    }

    if (line.includes('Standard Purchases')) {
      inPurchasesSection = true;
      inPaymentsSection = false;
      continue;
    }

    if (line.includes('Fees Charged') ||
        line.includes('Interest Charged') ||
        line.includes('totals year-to-date') ||
        line.includes('Costco Cash Back')) {
      inPaymentsSection = false;
      inPurchasesSection = false;
      continue;
    }

    if (!inPaymentsSection && !inPurchasesSection) {
      continue;
    }

    const twoDatePattern = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})\/(\d{1,2})\s+(.+?)\s+(-?\$[0-9,]+\.\d{2})$/;
    const oneDatePattern = /^(\d{1,2})\/(\d{1,2})\s+(.+?)\s+(-?\$[0-9,]+\.\d{2})$/;

    let match = line.match(twoDatePattern);
    let saleMonth, saleDay, postMonth, postDay, description, amountStr;
    let hasTwoDates = false;

    if (match) {
      [, saleMonth, saleDay, postMonth, postDay, description, amountStr] = match;
      hasTwoDates = true;
    } else {
      match = line.match(oneDatePattern);
      if (match) {
        [, postMonth, postDay, description, amountStr] = match;
      }
    }

    if (!match) {
      continue;
    }

    const cleanAmount = amountStr.replace(/[$,]/g, '');
    const isNegative = cleanAmount.startsWith('-');
    const amount = Math.abs(parseFloat(cleanAmount));

    const type = isNegative ? 'income' : 'expense';

    const month = postMonth.padStart(2, '0');
    const day = postDay.padStart(2, '0');
    let year = currentYear;

    if (parseInt(month) > new Date().getMonth() + 1) {
      year = currentYear - 1;
    }

    const transactionDate = `${year}-${month}-${day}`;

    let postDate: string | undefined;
    if (hasTwoDates) {
      const saleM = saleMonth.padStart(2, '0');
      const saleD = saleDay.padStart(2, '0');
      let saleY = year;
      if (parseInt(saleM) > new Date().getMonth() + 1) {
        saleY = currentYear - 1;
      }
      postDate = `${saleY}-${saleM}-${saleD}`;
    }

    transactions.push({
      date: transactionDate,
      description: description.trim(),
      amount,
      type,
      original_description: description.trim(),
      post_date: postDate
    });
  }

  return {
    transactions,
    institutionName,
    accountNumber,
    endingBalance,
    beginningBalance,
    statementStartDate,
    statementEndDate
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
    const { file_data, file_name } = await req.json();

    if (!file_data) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'No file data provided'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing PDF:', file_name);

    const pdfBytes = Uint8Array.from(atob(file_data), c => c.charCodeAt(0));
    console.log('PDF bytes length:', pdfBytes.length);

    let fullText = '';

    try {
      const { extractText } = await import('npm:unpdf@0.12.3');
      const extracted = await extractText(pdfBytes);
      fullText = extracted.text;
      console.log('PDF text extracted, length:', fullText.length);
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Failed to parse PDF file',
          details: pdfError.message || pdfError.toString()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const isCitiStatement = fullText.includes('Costco Anywhere Visa') ||
                           fullText.includes('Citi Cards') ||
                           fullText.includes('citicards.com');

    if (!isCitiStatement) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'PDF statement not recognized. Currently only Citi Costco Anywhere Visa statements are supported. For other banks, please use CSV or OFX files.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parsedData = parseCitiCostcoStatement(fullText);

    if (parsedData.transactions.length === 0) {
      console.log('Full text for debugging:', fullText.substring(0, 3000));
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'No transactions found in the PDF. The statement format may not be recognized.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Successfully parsed ${parsedData.transactions.length} transactions`);

    return new Response(
      JSON.stringify({
        status: 'success',
        output: {
          transactions: parsedData.transactions,
          institutionName: parsedData.institutionName,
          accountNumber: parsedData.accountNumber,
          endingBalance: parsedData.endingBalance,
          beginningBalance: parsedData.beginningBalance,
          statementStartDate: parsedData.statementStartDate,
          statementEndDate: parsedData.statementEndDate
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('PDF parsing error:', error);

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || 'Failed to parse PDF',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
