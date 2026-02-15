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

function extractTextFromPdf(pdfText: string): string[] {
  return pdfText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
}

function parseCitiCreditCardStatement(lines: string[]): {
  transactions: Transaction[];
  institutionName: string;
  accountNumber: string;
  statementDate: string;
  beginningBalance?: number;
  endingBalance?: number;
} {
  const transactions: Transaction[] = [];
  let institutionName = "Citi";
  let accountNumber = "";
  let statementDate = "";
  let endingBalance: number | undefined;

  let inTransactionSection = false;
  let currentYear = new Date().getFullYear();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("Account number ending in:")) {
      const match = line.match(/ending in:\s*(\d+)/i);
      if (match) accountNumber = match[1];
    }

    if (line.includes("Billing Period:")) {
      const match = line.match(/(\d{1,2}\/\d{1,2}\/\d{2})-(\d{1,2}\/\d{1,2}\/\d{2})/);
      if (match) {
        statementDate = match[2];
        const dateParts = match[2].split('/');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[2]);
          currentYear = year >= 50 ? 1900 + year : 2000 + year;
        }
      }
    }

    if (line.includes("New balance as of") || line.includes("New balance $")) {
      const match = line.match(/\$?([\d,]+\.\d{2})/);
      if (match) {
        endingBalance = parseFloat(match[1].replace(/,/g, ''));
      }
    }

    if (line.includes("Standard Purchases") || line.includes("Payments, Credits and Adjustments")) {
      inTransactionSection = true;
      continue;
    }

    if (line.includes("Fees Charged") || line.includes("Interest Charged") ||
        line.includes("2026 totals year-to-date") || line.includes("2027 totals year-to-date")) {
      inTransactionSection = false;
      continue;
    }

    if (inTransactionSection) {
      const citiTransactionPattern = /^(\d{1,2}\/\d{1,2})(?:\s+(\d{1,2}\/\d{1,2}))?\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})$/;
      const match = line.match(citiTransactionPattern);

      if (match) {
        const [, saleDate, postDate, description, amountStr] = match;

        const cleanAmount = parseFloat(amountStr.replace(/[$,]/g, ''));
        const isNegative = amountStr.includes('-');

        const amount = Math.abs(cleanAmount);
        const type = isNegative ? 'income' : 'expense';

        let transactionDate = saleDate;
        if (postDate) {
          transactionDate = postDate;
        }

        const [month, day] = transactionDate.split('/').map(d => d.padStart(2, '0'));
        let year = currentYear;

        if (parseInt(month) > new Date().getMonth() + 1) {
          year = currentYear - 1;
        }

        const formattedDate = `${year}-${month}-${day}`;

        const cleanDescription = description.trim();

        transactions.push({
          date: formattedDate,
          description: cleanDescription,
          amount,
          type,
          original_description: cleanDescription,
          post_date: postDate ? `${year}-${postDate.split('/').map(d => d.padStart(2, '0')).join('-')}` : undefined
        });
      }
    }
  }

  return {
    transactions,
    institutionName,
    accountNumber,
    statementDate,
    endingBalance
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
      // Use pdf-parse which works better in Deno
      const pdfParse = (await import('npm:pdf-parse@1.1.1')).default;

      console.log('pdf-parse loaded');

      const pdfData = await pdfParse(pdfBytes);

      console.log('PDF parsed, pages:', pdfData.numpages);
      console.log('Text length:', pdfData.text.length);

      fullText = pdfData.text;
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

    const lines = extractTextFromPdf(fullText);

    console.log('First 20 lines of extracted text:', lines.slice(0, 20));

    const isCitiStatement = lines.some(line =>
      line.includes('Costco Anywhere Visa') ||
      line.includes('Citi Cards') ||
      line.includes('citicards.com')
    );

    let parsedData;

    if (isCitiStatement) {
      parsedData = parseCitiCreditCardStatement(lines);
    } else {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'PDF statement not recognized. Currently only Citi credit card statements are supported. For other banks, please use CSV or OFX files.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (parsedData.transactions.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'No transactions found in the PDF. Please check that this is a valid statement.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        output: {
          transactions: parsedData.transactions,
          institutionName: parsedData.institutionName,
          accountNumber: parsedData.accountNumber,
          endingBalance: parsedData.endingBalance
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
