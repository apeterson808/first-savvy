import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
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

const institutionMap = {
  'Citi': 'Citibank',
  'American Express': 'American Express',
  'Idaho Central Credit Union': 'Idaho Central Credit Union'
};

const monthMap = {
  'sep': 9,
  'oct': 10,
  'nov': 11,
  'dec': 12
};

async function getInstitutionId(institutionName) {
  const mappedName = institutionMap[institutionName] || institutionName;

  const { data, error } = await supabase
    .from('financial_institutions')
    .select('id')
    .eq('name', mappedName)
    .maybeSingle();

  if (error || !data) {
    console.error(`Institution not found: ${mappedName}`);
    return null;
  }

  return data.id;
}

function extractMonthYear(filename) {
  const parts = filename.replace('.pdf', '').split('_');
  const month = parts[parts.length - 1].toLowerCase();
  const year = 2024;

  return { month, year };
}

async function cacheAllStatements() {
  console.log('\n' + '='.repeat(60));
  console.log('CACHING STATEMENTS FOR BANK SIMULATION');
  console.log('='.repeat(60) + '\n');

  await supabase.from('statement_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared existing statement cache\n');

  const statementsDir = join(__dirname, '..', 'public', 'statements');
  const files = readdirSync(statementsDir)
    .filter(f => f.endsWith('.pdf') && !f.includes('copy'));

  console.log(`Found ${files.length} unique PDF files to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      console.log(`Processing ${file}...`);
      const filePath = join(statementsDir, file);

      let parsedData = await parsePDFStatement(filePath);

      const statements = Array.isArray(parsedData) ? parsedData : [parsedData];

      const { month, year } = extractMonthYear(file);

      for (const statementData of statements) {
        const institutionId = await getInstitutionId(statementData.institution);

        if (!institutionId) {
          console.error(`  Skipping: Institution not found`);
          errorCount++;
          continue;
        }

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
            institution_name: institutionMap[statementData.institution] || statementData.institution,
            account_type: statementData.accountType,
            account_number_last4: last4,
            statement_month: month,
            statement_year: year,
            transactions_data: statementData.transactions,
            transaction_count: statementData.transactions.length,
            total_debits: totalDebits.toFixed(2),
            total_credits: totalCredits.toFixed(2),
            file_name: file,
            beginning_balance: statementData.beginningBalance,
            ending_balance: statementData.endingBalance
          });

        if (error) {
          console.error(`  Error caching: ${error.message}`);
          errorCount++;
        } else {
          console.log(`  Cached ${statementData.transactions.length} transactions (${statementData.accountType})`);
          successCount++;
        }
      }

    } catch (error) {
      console.error(`  Error processing: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('CACHING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Success: ${successCount}`);
  console.log(`Errors:  ${errorCount}`);
  console.log(`Total:   ${files.length}`);
  console.log('='.repeat(60) + '\n');

  const { data: cacheData } = await supabase
    .from('statement_cache')
    .select('institution_name, account_type, transaction_count');

  console.log('Cached Statements by Institution:');
  const grouped = {};
  cacheData.forEach(item => {
    const key = `${item.institution_name} (${item.account_type})`;
    if (!grouped[key]) {
      grouped[key] = { count: 0, transactions: 0 };
    }
    grouped[key].count++;
    grouped[key].transactions += item.transaction_count;
  });

  Object.entries(grouped).forEach(([key, value]) => {
    console.log(`  ${key}: ${value.count} statements, ${value.transactions} transactions`);
  });

  console.log('\n Bank simulation ready!\n');
}

cacheAllStatements().catch(console.error);
