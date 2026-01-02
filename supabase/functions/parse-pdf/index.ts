import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import pdfParse from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type?: string;
}

function parseTransactionsFromText(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}\/\d{2}|\d{4}-\d{2}-\d{2})/,
    /(\d{2}\/\d{2})/,
  ];

  const amountPattern = /\$?(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 10) continue;

    let dateMatch = null;
    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) break;
    }

    if (!dateMatch) continue;

    const amountMatches = line.match(new RegExp(amountPattern, 'g'));
    if (!amountMatches || amountMatches.length === 0) continue;

    const dateStr = dateMatch[1];
    const lastAmount = amountMatches[amountMatches.length - 1]
      .replace('$', '')
      .replace(',', '');

    const amount = parseFloat(lastAmount);
    if (isNaN(amount) || amount === 0) continue;

    const descStartIndex = line.indexOf(dateStr) + dateStr.length;
    const amountIndex = line.lastIndexOf(lastAmount);

    let description = line.substring(descStartIndex, amountIndex).trim();
    description = description.replace(/\s+/g, ' ').trim();

    if (!description || description.length < 2) {
      description = line.replace(dateStr, '').replace(lastAmount, '').trim();
    }

    if (description && description.length > 2) {
      transactions.push({
        date: normalizeDate(dateStr),
        description: cleanDescription(description),
        amount: amount,
        type: amount < 0 ? 'expense' : 'income'
      });
    }
  }

  return deduplicateTransactions(transactions);
}

function normalizeDate(dateStr: string): string {
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

  const [month, day, year] = cleaned.split(/[-\/]/);
  if (month && day && year) {
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  return cleaned;
}

function cleanDescription(desc: string): string {
  let cleaned = desc.trim();

  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*[-•*]\s*/, '');
  cleaned = cleaned.replace(/\$[\d,]+\.?\d*/g, '');

  return cleaned.trim();
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
    const { file_url } = await req.json();

    if (!file_url) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'file_url is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Authorization header required'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Invalid authentication token'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const pdfResponse = await fetch(file_url);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);

    const data = await pdfParse(uint8Array);
    const text = data.text;

    if (!text || text.length < 50) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Could not extract text from PDF. The PDF might be image-based or encrypted.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const transactions = parseTransactionsFromText(text);

    if (transactions.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'No transactions found in PDF. Please make sure this is a valid bank statement.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const institutionMatch = text.match(/(?:bank|credit\s+card|statement\s+from)\s+(.{3,50})/i);
    const institutionName = institutionMatch
      ? institutionMatch[1].split('\n')[0].trim()
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
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
