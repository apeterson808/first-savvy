import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as readline from 'readline';

const envContent = readFileSync('/tmp/cc-agent/61486229/project/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function importDemoTransactions() {
  console.log('🚀 Demo Transaction Import with Auto-Matching\n');

  const email = await askQuestion('Enter your email: ');
  const password = await askQuestion('Enter your password: ');

  console.log('\n🔐 Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError || !authData.user) {
    console.error('❌ Authentication failed:', authError?.message || 'Unknown error');
    return;
  }

  const user = authData.user;
  console.log('✅ Authenticated as:', user.email, '\n');

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(3);

  if (!accounts || accounts.length < 2) {
    console.error('❌ Need at least 2 accounts. Please create accounts first.');
    return;
  }

  const [account1, account2, account3] = accounts;
  console.log(`📊 Using accounts:`);
  console.log(`   - ${account1.name} (${account1.account_type})`);
  console.log(`   - ${account2.name} (${account2.account_type})`);
  if (account3) console.log(`   - ${account3.name} (${account3.account_type})`);
  console.log('');

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const formatDate = (date) => date.toISOString().split('T')[0];

  const transactions = [
    {
      date: formatDate(twoDaysAgo),
      description: 'Transfer to Savings',
      amount: -500.00,
      type: 'expense',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'bank_transfer',
      user_id: user.id
    },
    {
      date: formatDate(twoDaysAgo),
      description: 'Transfer from Checking',
      amount: 500.00,
      type: 'income',
      account_id: account2.id,
      status: 'pending',
      payment_method: 'bank_transfer',
      user_id: user.id
    },
    {
      date: formatDate(yesterday),
      description: 'Grocery Store',
      amount: 127.45,
      type: 'expense',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'debit_card',
      user_id: user.id
    },
    {
      date: formatDate(yesterday),
      description: 'Gas Station',
      amount: 45.00,
      type: 'expense',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'debit_card',
      user_id: user.id
    },
    {
      date: formatDate(threeDaysAgo),
      description: 'Paycheck Direct Deposit',
      amount: 3250.00,
      type: 'income',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'bank_transfer',
      user_id: user.id
    },
    {
      date: formatDate(today),
      description: 'Coffee Shop',
      amount: 6.75,
      type: 'expense',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'debit_card',
      user_id: user.id
    }
  ];

  if (account3) {
    transactions.push({
      date: formatDate(yesterday),
      description: 'Internal Account Transfer',
      amount: -200.00,
      type: 'expense',
      account_id: account1.id,
      status: 'pending',
      payment_method: 'bank_transfer',
      user_id: user.id
    });
    transactions.push({
      date: formatDate(yesterday),
      description: 'Internal Account Transfer',
      amount: 200.00,
      type: 'income',
      account_id: account3.id,
      status: 'pending',
      payment_method: 'bank_transfer',
      user_id: user.id
    });
  }

  console.log('📝 Importing transactions...');
  const { data: created, error: insertError } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (insertError) {
    console.error('❌ Error importing transactions:', insertError);
    return;
  }

  console.log(`✅ Imported ${created.length} transactions\n`);

  console.log('🔍 Running auto-matching algorithm...\n');

  const { data: allPending } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .is('transfer_pair_id', null);

  let matchedCount = 0;
  const processedIds = new Set();
  const updates = [];

  for (const txn of created) {
    if (processedIds.has(txn.id) || txn.transfer_pair_id) continue;

    for (const candidate of allPending) {
      if (processedIds.has(candidate.id) || candidate.transfer_pair_id) continue;
      if (candidate.id === txn.id) continue;

      const amountMatch = Math.abs(Math.abs(txn.amount) - Math.abs(candidate.amount)) < 0.01;
      const oppositeSigns = (txn.amount > 0 && candidate.amount < 0) || (txn.amount < 0 && candidate.amount > 0);

      const txnDate = new Date(txn.date);
      const candidateDate = new Date(candidate.date);
      const daysDiff = Math.abs((txnDate - candidateDate) / (1000 * 60 * 60 * 24));
      const dateMatch = daysDiff <= 7;

      if (!amountMatch || !oppositeSigns || !dateMatch) continue;

      const normalizeDesc = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      const txnDesc = normalizeDesc(txn.description);
      const candidateDesc = normalizeDesc(candidate.description);

      const commonWords = txnDesc.split(' ').filter(word =>
        word.length > 3 && candidateDesc.includes(word)
      ).length;

      let confidence = 50;
      confidence += Math.max(0, 30 - daysDiff * 4);
      confidence += commonWords * 10;

      if (confidence >= 80) {
        const pairId = crypto.randomUUID();

        console.log(`✨ Auto-matched transfer (${confidence}% confidence):`);
        console.log(`   ${txn.description} ($${Math.abs(txn.amount).toFixed(2)}) in ${accounts.find(a => a.id === txn.account_id)?.name}`);
        console.log(`   ↕️`);
        console.log(`   ${candidate.description} ($${Math.abs(candidate.amount).toFixed(2)}) in ${accounts.find(a => a.id === candidate.account_id)?.name}`);
        console.log('');

        updates.push({
          id: txn.id,
          transfer_pair_id: pairId,
          type: 'transfer',
          original_type: txn.type,
          category_id: null
        });

        updates.push({
          id: candidate.id,
          transfer_pair_id: pairId,
          type: 'transfer',
          original_type: candidate.type,
          category_id: null
        });

        processedIds.add(txn.id);
        processedIds.add(candidate.id);
        matchedCount++;
        break;
      }
    }
  }

  if (updates.length > 0) {
    for (const update of updates) {
      const { id, ...data } = update;
      await supabase
        .from('transactions')
        .update(data)
        .eq('id', id);
    }
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`   Imported: ${created.length} transactions`);
  console.log(`   Auto-matched: ${matchedCount} transfer pairs`);
  console.log(`\n👉 Check your Banking > Transactions tab to see the results!`);
}

importDemoTransactions().catch(console.error);
