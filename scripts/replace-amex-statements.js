import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parsePDFStatement } from './pdf-statement-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return envVars;
  } catch (error) {
    console.error('Error reading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const monthMap = {
  'sep': 9,
  'oct': 10,
  'nov': 11,
  'dec': 12
};

async function getInstitutionId(institutionName) {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('id')
    .eq('name', 'American Express')
    .maybeSingle();

  if (error || !data) {
    console.error('American Express institution not found in database');
    return null;
  }

  return data.id;
}

function extractMonthYear(filename) {
  const parts = filename.replace('.pdf', '').split('_');
  const month = parts[parts.length - 1].toLowerCase();
  const year = 2025;

  return { month, year };
}

async function replaceAmexStatements() {
  console.log('\n' + '='.repeat(60));
  console.log('REPLACING AMERICAN EXPRESS STATEMENTS');
  console.log('='.repeat(60) + '\n');

  const { data: existingAmex, error: checkError } = await supabase
    .from('statement_cache')
    .select('id, file_name, transaction_count')
    .eq('institution_name', 'American Express');

  if (checkError) {
    console.error('Error checking existing Amex statements:', checkError.message);
    return;
  }

  console.log(`Found ${existingAmex?.length || 0} existing American Express statements`);
  if (existingAmex?.length > 0) {
    existingAmex.forEach(stmt => {
      console.log(`  - ${stmt.file_name} (${stmt.transaction_count} transactions)`);
    });
  }

  console.log('\nDeleting existing American Express statements...');
  const { error: deleteError } = await supabase
    .from('statement_cache')
    .delete()
    .eq('institution_name', 'American Express');

  if (deleteError) {
    console.error('Error deleting American Express statements:', deleteError.message);
    return;
  }
  console.log('Cleared American Express cache\n');

  const institutionId = await getInstitutionId('American Express');
  if (!institutionId) {
    console.error('Cannot proceed without institution ID');
    return;
  }

  const amexFiles = ['amex_sep.pdf', 'amex_oct.pdf', 'amex_nov.pdf', 'amex_dec.pdf'];
  console.log(`Processing ${amexFiles.length} American Express PDFs\n`);

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const file of amexFiles) {
    try {
      console.log(`Processing ${file}...`);
      const filePath = join(__dirname, '..', 'public', file);

      const statementData = await parsePDFStatement(filePath);

      const { month, year } = extractMonthYear(file);

      const last4 = statementData.accountNumber.slice(-4);

      const totalDebits = statementData.transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const totalCredits = statementData.transactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const { error } = await supabase
        .from('statement_cache')
        .insert({
          institution_id: institutionId,
          institution_name: 'American Express',
          account_type: statementData.accountType,
          account_number_last4: last4,
          statement_month: month,
          statement_year: year,
          transactions_data: statementData.transactions,
          transaction_count: statementData.transactions.length,
          total_debits: totalDebits.toFixed(2),
          total_credits: totalCredits.toFixed(2),
          file_name: file
        });

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✓ Cached ${statementData.transactions.length} transactions`);
        results.push({
          file,
          transactions: statementData.transactions.length,
          debits: totalDebits,
          credits: totalCredits
        });
        successCount++;
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('REPLACEMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Success: ${successCount}`);
  console.log(`Errors:  ${errorCount}`);
  console.log(`Total:   ${amexFiles.length}`);
  console.log('='.repeat(60) + '\n');

  if (results.length > 0) {
    console.log('New American Express Statements:');
    results.forEach(result => {
      console.log(`  ${result.file}: ${result.transactions} transactions`);
      console.log(`    Debits: $${result.debits.toFixed(2)}, Credits: $${result.credits.toFixed(2)}`);
    });
    console.log('\n✓ American Express statements replaced successfully!\n');
  }
}

replaceAmexStatements().catch(console.error);
