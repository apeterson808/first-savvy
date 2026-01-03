import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parsePDFStatement } from './pdf-statement-parser.js';
import * as readline from 'readline';

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
    console.error('❌ Error reading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function promptConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n⚠️  WARNING: This will DELETE ALL existing transactions and accounts!\nType "DELETE" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'DELETE');
    });
  });
}

async function cleanupDatabase() {
  console.log('\n🗑️  Starting database cleanup...\n');

  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  const { count: accountCount } = await supabase.from('user_chart_of_accounts').select('*', { count: 'exact', head: true });

  console.log(`Found ${txCount || 0} transactions`);
  console.log(`Found ${accountCount || 0} chart of accounts entries`);

  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Deleted transactions');

  const { data: accounts } = await supabase
    .from('user_chart_of_accounts')
    .select('id, account_id')
    .not('account_id', 'is', null);

  if (accounts && accounts.length > 0) {
    const accountIds = accounts.map(a => a.account_id).filter(Boolean);
    if (accountIds.length > 0) {
      await supabase.from('bank_accounts').delete().in('id', accountIds);
      console.log('✓ Deleted linked bank accounts');
    }
  }

  console.log('\n✅ Database cleanup complete!\n');
}

async function processStatements(userId, profileId) {
  console.log('📄 Processing PDF statements...\n');

  const statementsDir = join(__dirname, '..', 'public', 'statements');
  const files = readdirSync(statementsDir).filter(f => f.endsWith('.pdf'));

  console.log(`Found ${files.length} PDF files to process\n`);

  const accountMap = new Map();
  const allTransactions = [];

  for (const file of files) {
    try {
      console.log(`  Processing ${file}...`);
      const filePath = join(statementsDir, file);

      const statementData = await parsePDFStatement(filePath);

      const accountKey = `${statementData.institution}-${statementData.accountNumber}`;

      if (!accountMap.has(accountKey)) {
        const accountName = `${statementData.institution} ${statementData.accountType === 'credit' ? 'Credit Card' : 'Checking'} ${statementData.accountNumber}`;

        const chartAccount = await supabase
          .from('user_chart_of_accounts')
          .select('id, account_number')
          .eq('profile_id', profileId)
          .eq('account_type', statementData.accountType === 'credit' ? 'liability' : 'asset')
          .eq('account_detail', statementData.accountType === 'credit' ? 'credit_card' : 'checking')
          .limit(1)
          .maybeSingle();

        let bankAccountId;

        if (chartAccount && chartAccount.id) {
          const { data: bankAccount, error: bankError } = await supabase
            .from('bank_accounts')
            .insert({
              user_id: userId,
              profile_id: profileId,
              name: accountName,
              institution: statementData.institution,
              type: statementData.accountType === 'credit' ? 'credit' : 'checking',
              account_number: statementData.accountNumber,
              current_balance: 0,
              is_active: true
            })
            .select()
            .single();

          if (bankError) {
            console.error(`    ❌ Error creating bank account: ${bankError.message}`);
            continue;
          }

          bankAccountId = bankAccount.id;

          await supabase
            .from('user_chart_of_accounts')
            .update({ account_id: bankAccountId })
            .eq('id', chartAccount.id);

          accountMap.set(accountKey, {
            id: bankAccountId,
            chartAccountId: chartAccount.id,
            ...statementData
          });

          console.log(`    ✓ Created account: ${accountName}`);
        } else {
          console.error(`    ❌ No chart account found for ${statementData.accountType}`);
          continue;
        }
      }

      const account = accountMap.get(accountKey);

      for (const tx of statementData.transactions) {
        allTransactions.push({
          user_id: userId,
          profile_id: profileId,
          bank_account_id: account.id,
          date: tx.date,
          description: tx.description,
          original_description: tx.description,
          amount: tx.amount,
          type: tx.type,
          status: tx.status,
          source: 'statement_upload'
        });
      }

      console.log(`    ✓ Extracted ${statementData.transactions.length} transactions`);

    } catch (error) {
      console.error(`    ❌ Error processing ${file}: ${error.message}`);
    }
  }

  if (allTransactions.length > 0) {
    console.log(`\n💾 Inserting ${allTransactions.length} transactions into database...`);

    const batchSize = 500;
    for (let i = 0; i < allTransactions.length; i += batchSize) {
      const batch = allTransactions.slice(i, i + batchSize);
      const { error } = await supabase.from('transactions').insert(batch);

      if (error) {
        console.error(`❌ Error inserting batch: ${error.message}`);
      } else {
        console.log(`  ✓ Inserted transactions ${i + 1} to ${Math.min(i + batchSize, allTransactions.length)}`);
      }
    }
  }

  return {
    accountsCreated: accountMap.size,
    transactionsCreated: allTransactions.length
  };
}

async function printSummary(stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 REAL STATEMENT IMPORT SUMMARY');
  console.log('='.repeat(60) + '\n');

  const { count: accountCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true });
  const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });

  console.log(`🏦 Bank Accounts Created:    ${stats.accountsCreated}`);
  console.log(`💰 Transactions Imported:    ${stats.transactionsCreated}`);
  console.log(`\n📈 Database Totals:`);
  console.log(`   Total Accounts:           ${accountCount}`);
  console.log(`   Total Transactions:       ${txCount}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Real statement import complete!');
  console.log('🎉 Your system now uses authentic bank data from PDF statements');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('📄 REAL BANK STATEMENT IMPORTER');
  console.log('='.repeat(60));
  console.log('This will import actual transactions from your PDF statements');
  console.log('='.repeat(60));

  const userId = '0056b95c-7bbc-49dc-920b-b0e6e628986d';
  const userEmail = 'petersonandrew@hotmail.com';

  console.log(`\n👤 Importing data for: ${userEmail} (${userId})`);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (!profiles || profiles.length === 0) {
    console.error('❌ No profile found for user');
    process.exit(1);
  }

  const profileId = profiles[0].id;

  const confirmed = await promptConfirmation();

  if (!confirmed) {
    console.log('\n❌ Import operation cancelled.\n');
    process.exit(0);
  }

  try {
    await cleanupDatabase();

    const stats = await processStatements(userId, profileId);

    await printSummary(stats);

    const endTime = Date.now();
    console.log(`⏱️  Execution time: ${((endTime - startTime) / 1000).toFixed(2)}s\n`);

  } catch (error) {
    console.error('\n❌ Error during import operation:', error);
    process.exit(1);
  }
}

main();
