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
  type?: string;
}

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(pdfBuffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = decoder.decode(uint8Array);

  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, ' ');
  text = text.replace(/\s+/g, ' ');

  return text;
}

function parseTransactionsFromText(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split(/[\n\r]+/);

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}\/\d{2})/,
  ];

  const amountPattern = /\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 10) continue;

    let dateMatch = null;
    let matchedPattern = null;
    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) {
        matchedPattern = pattern;
        break;
      }
    }

    if (!dateMatch) continue;

    const amountMatches = Array.from(line.matchAll(amountPattern));
    if (!amountMatches || amountMatches.length === 0) continue;

    const dateStr = dateMatch[1];
    const lastAmountMatch = amountMatches[amountMatches.length - 1];
    const lastAmount = lastAmountMatch[1]
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .trim();

    const amount = parseFloat(lastAmount);
    if (isNaN(amount) || amount === 0) continue;

    const dateStartIndex = line.indexOf(dateStr);
    const amountStartIndex = lastAmountMatch.index || 0;

    let description = '';
    if (amountStartIndex > dateStartIndex) {
      const descStartIndex = dateStartIndex + dateStr.length;
      description = line.substring(descStartIndex, amountStartIndex).trim();
    } else {
      description = line.replace(dateStr, '').replace(lastAmount, '').trim();
    }

    description = description.replace(/\s+/g, ' ').trim();
    description = description.replace(/^\s*[-•*]\s*/, '');
    description = description.replace(/\$[\d,]+\.?\d*/g, '');
    description = description.trim();

    if (description && description.length > 2) {
      const normalizedDate = normalizeDate(dateStr);
      if (normalizedDate) {
        transactions.push({
          date: normalizedDate,
          description: description,
          amount: Math.abs(amount),
          type: amount < 0 ? 'expense' : 'income'
        });
      }
    }
  }

  return deduplicateTransactions(transactions);
}

function normalizeDate(dateStr: string): string | null {
  let cleaned = dateStr.trim();

  if (/^\d{2}\/\d{2}$/.test(cleaned)) {
    const currentYear = new Date().getFullYear();
    cleaned = `${cleaned}/${currentYear}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleaned)) {
    const [month, day, year] = cleaned.split('/');
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    cleaned = `${month}/${day}/${fullYear}`;
  }

  let month: string, day: string, year: string;

  if (cleaned.includes('/')) {
    [month, day, year] = cleaned.split('/');
  } else if (cleaned.includes('-')) {
    [year, month, day] = cleaned.split('-');
  } else {
    return null;
  }

  if (month && day && year) {
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    const formatted = `${year}-${m}-${d}`;

    const testDate = new Date(formatted);
    if (!isNaN(testDate.getTime())) {
      return formatted;
    }
  }

  return null;
}

function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const unique: Transaction[] = [];

  for (const txn of transactions) {
    const key = `${txn.date}|${txn.description}|${txn.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(txn);
    }
  }

  return unique;
}

Deno.serve(async (req: Request) => {  
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = await req.json();
    console.log('Received request body keys:', Object.keys(requestBody));

    const file_data = requestBody.file_data;
    const file_name = requestBody.file_name || 'unknown.pdf';

    if (!file_data) {
      console.error('Missing file_data in request. Body keys:', Object.keys(requestBody));
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'file_data is required',
          received_keys: Object.keys(requestBody)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing PDF: ${file_name}, data length: ${file_data.length}`);

    let pdfBuffer: ArrayBuffer;
    try {
      const binaryString = atob(file_data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      pdfBuffer = bytes.buffer;
      console.log('Decoded PDF buffer, size:', pdfBuffer.byteLength);
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const text = await extractTextFromPDF(pdfBuffer);
    console.log('Extracted text length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));

    if (!text || text.length < 50) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Could not extract text from PDF. The PDF might be image-based, encrypted, or in an unsupported format. Please try uploading a CSV file instead.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const transactions = parseTransactionsFromText(text);
    console.log('Parsed transactions:', transactions.length);

    if (transactions.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'No transactions found in PDF. The PDF format may not be supported. Please try uploading a CSV or OFX file instead.',
          details: `Extracted ${text.length} characters of text but could not parse transactions`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const institutionMatch = text.match(/(?:bank|credit\s+card|statement\s+from)\s+(.{3,50})/i);
    const institutionName = institutionMatch
      ? institutionMatch[1].split(/[\n\r]/)[0].trim()
      : 'Unknown Institution';

    return new Response(
      JSON.stringify({
        status: 'success',
        output: {
          transactions,
          institutionName,
          accountNumber: 'PDF Import',
          format: 'pdf'
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error parsing PDF:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: 'Failed to parse PDF',
        details: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
