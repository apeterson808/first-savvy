import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type?: string;
  confidence?: number;
}

interface ClaudeVisionResponse {
  transactions: Transaction[];
  institutionName?: string;
  accountNumber?: string;
  statementPeriod?: string;
}

async function extractTransactionsWithClaude(
  text: string,
  userBankAccounts: any[]
): Promise<ClaudeVisionResponse | null> {
  if (!ANTHROPIC_API_KEY) {
    console.log('No Anthropic API key, skipping AI extraction');
    return null;
  }

  const accountsList = userBankAccounts.length > 0
    ? userBankAccounts.map(acc => `${acc.institution_name || 'Unknown'} - ${acc.account_name} (ending in ${acc.last_four || 'N/A'})`).join('\n')
    : 'No accounts available';

  const prompt = `You are a financial document analysis expert. Analyze this bank statement text and extract ALL transactions in structured format.

User's Bank Accounts:
${accountsList}

TEXT FROM BANK STATEMENT:
${text.substring(0, 15000)}

Instructions:
1. Extract ALL transaction rows from the statement
2. For each transaction, identify:
   - Date (format as YYYY-MM-DD)
   - Description (merchant name, purpose)
   - Amount (as a positive number)
   - Type ("expense" for debits/charges, "income" for deposits/credits)
3. Also identify:
   - Institution name (e.g., "Chase", "Bank of America")
   - Account number (last 4 digits if visible)
   - Statement period if visible
4. Return confidence score 0-100 for each transaction

Return ONLY valid JSON with this exact structure:
{
  "institutionName": "<bank name>",
  "accountNumber": "<last 4 digits or partial account>",
  "statementPeriod": "<date range if visible>",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "<merchant or description>",
      "amount": <positive number>,
      "type": "expense" or "income",
      "confidence": <0-100>
    }
  ]
}

If this is not a bank statement, return: {"transactions": []}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      console.error('No content in Claude response');
      return null;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Claude response:', content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return null;
  }
}

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(pdfBuffer);
  const decoder = new TextDecoder('latin1', { fatal: false });
  let rawText = decoder.decode(uint8Array);

  const textChunks: string[] = [];

  const tjRegex = /\(((?:[^()\\]|\\.)*?)\)\s*Tj/gi;
  let match;
  while ((match = tjRegex.exec(rawText)) !== null) {
    let content = match[1];
    content = content.replace(/\\([nrtbf\\()])/g, (_, char) => {
      const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')' };
      return map[char] || char;
    });
    content = content.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    if (content.trim().length > 0) {
      textChunks.push(content.trim());
    }
  }

  const tjArrayRegex = /\[((?:[^\[\]]|\[.*?\])*?)\]\s*TJ/gi;
  while ((match = tjArrayRegex.exec(rawText)) !== null) {
    const arrayContent = match[1];
    const stringMatches = arrayContent.match(/\(((?:[^()\\]|\\.)*?)\)/g);
    if (stringMatches) {
      for (const strMatch of stringMatches) {
        let content = strMatch.slice(1, -1);
        content = content.replace(/\\([nrtbf\\()])/g, (_, char) => {
          const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')' };
          return map[char] || char;
        });
        content = content.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
        if (content.trim().length > 0) {
          textChunks.push(content.trim());
        }
      }
    }
  }

  const tdRegex = /\(((?:[^()\\]|\\.)*?)\)\s*TD/gi;
  while ((match = tdRegex.exec(rawText)) !== null) {
    let content = match[1];
    content = content.replace(/\\([nrtbf\\()])/g, (_, char) => {
      const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '(': '(', ')': ')' };
      return map[char] || char;
    });
    content = content.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    if (content.trim().length > 0) {
      textChunks.push(content.trim());
    }
  }

  let text = textChunks.join(' ');
  text = text.replace(/\s+/g, ' ').trim();

  console.log('Extracted text chunks:', textChunks.length);
  console.log('Final text length:', text.length);
  console.log('First 500 chars:', text.substring(0, 500));
  console.log('Sample chunks:', textChunks.slice(0, 20));

  return text;
}

function parseTransactionsFromText(text: string): Transaction[] {
  const transactions: Transaction[] = [];

  const words = text.split(/\s+/);
  const chunkSize = 50;
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    lines.push(words.slice(i, i + chunkSize).join(' '));
  }

  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}\/\d{2})/,
    /(\d{1,2}-\d{1,2}-\d{4})/,
    /(\d{1,2}-\d{1,2}-\d{2})/,
  ];

  const amountPattern = /\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 5) continue;

    let dateMatch = null;
    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) break;
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

    if (description && description.length > 1) {
      const normalizedDate = normalizeDate(dateStr);
      if (normalizedDate) {
        transactions.push({
          date: normalizedDate,
          description: description,
          amount: Math.abs(amount),
          type: amount < 0 ? 'expense' : 'income',
          confidence: 50
        });
      }
    }
  }

  console.log('Raw transactions found:', transactions.length);
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

function matchBankAccount(
  institutionName: string | undefined,
  accountNumber: string | undefined,
  userBankAccounts: any[]
): string | null {
  if (!institutionName && !accountNumber) return null;

  const institutionLower = institutionName?.toLowerCase() || '';
  const accountLower = accountNumber?.toLowerCase() || '';

  for (const account of userBankAccounts) {
    const accInstitution = (account.institution_name || '').toLowerCase();
    const accLastFour = (account.last_four || '').toLowerCase();
    const accName = (account.account_name || '').toLowerCase();

    if (institutionLower && accInstitution.includes(institutionLower)) {
      if (accountLower && accLastFour && accountLower.includes(accLastFour)) {
        return account.id;
      }
      if (!accountNumber) {
        return account.id;
      }
    }

    if (accountLower && accLastFour && accountLower.includes(accLastFour)) {
      return account.id;
    }
  }

  return null;
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
    console.log('Request body keys:', Object.keys(requestBody));

    let file_data: string;
    let file_name = 'unknown.pdf';
    let profile_id = requestBody.profile_id;

    if (requestBody.body) {
      console.log('Unwrapping body property');
      file_data = requestBody.body.file_data;
      file_name = requestBody.body.file_name || file_name;
      profile_id = requestBody.body.profile_id || profile_id;
    } else {
      file_data = requestBody.file_data;
      file_name = requestBody.file_name || file_name;
    }

    if (!file_data) {
      console.error('Missing file_data. Request structure:', JSON.stringify(Object.keys(requestBody)));
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

    const bankAccounts: any[] = [];

    let transactions: Transaction[] = [];
    let institutionName = 'Unknown Institution';
    let accountNumber = 'PDF Import';
    let suggestedAccountId: string | null = null;
    let extractionMethod = 'text';

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
    console.log('Text preview:', text.substring(0, 1000));

    if (!text || text.length < 20) {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Could not extract readable text from PDF. This PDF might be image-based (scanned), encrypted, or use an unsupported encoding. Please try uploading a CSV or OFX file instead.',
          details: `Only extracted ${text?.length || 0} characters`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (ANTHROPIC_API_KEY) {
      console.log('Attempting Claude AI extraction...');
      try {
        const aiResult = await extractTransactionsWithClaude(text, bankAccounts);

        if (aiResult && aiResult.transactions && aiResult.transactions.length > 0) {
          console.log(`Claude AI extracted ${aiResult.transactions.length} transactions`);
          transactions = aiResult.transactions;
          institutionName = aiResult.institutionName || institutionName;
          accountNumber = aiResult.accountNumber || accountNumber;
          extractionMethod = 'ai';

          suggestedAccountId = matchBankAccount(institutionName, accountNumber, bankAccounts);
          console.log(`Matched account: ${suggestedAccountId}`);
        } else {
          console.log('AI extraction failed or returned no transactions, falling back to regex parsing');
        }
      } catch (aiError) {
        console.error('AI extraction error, falling back to regex parsing:', aiError);
      }
    } else {
      console.log('No Anthropic API key configured, skipping AI extraction');
    }

    if (transactions.length === 0) {
      console.log('Using regex-based text parsing fallback...');
      transactions = parseTransactionsFromText(text);
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
      institutionName = institutionMatch
        ? institutionMatch[1].split(/[\n\r]/)[0].trim()
        : 'Unknown Institution';
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        output: {
          transactions,
          institutionName,
          accountNumber,
          suggestedAccountId,
          extractionMethod,
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
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
