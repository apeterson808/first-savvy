import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
const userEmail = 'petersonandrew@hotmail.com';
const userPassword = envVars.SEED_USER_PASSWORD;

const supabase = createClient(supabaseUrl, supabaseKey);

async function categorizeAllPosted() {
  console.log('Signing in...');
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });

  if (signInError) {
    console.error('Sign in failed:', signInError);
    return;
  }

  console.log('✓ Signed in successfully\n');

  console.log('Fetching uncategorized posted transactions...');
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, description, amount, type, status, profile_id')
    .eq('status', 'posted')
    .is('chart_account_id', null)
    .order('date', { ascending: true });

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  console.log(`Found ${transactions.length} uncategorized posted transactions\n`);

  if (transactions.length === 0) {
    console.log('✓ No transactions to categorize!');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    console.log(`[${i + 1}/${transactions.length}] ${tx.description.substring(0, 50)} ($${tx.amount})`);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-categorize-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: tx.description,
            amount: parseFloat(tx.amount),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  ✗ API Error (${response.status}):`, errorText);
        failCount++;
        continue;
      }

      const result = await response.json();

      if (result.chartAccountId) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            chart_account_id: result.chartAccountId
          })
          .eq('id', tx.id);

        if (updateError) {
          console.error(`  ✗ Update failed:`, updateError);
          failCount++;
        } else {
          console.log(`  ✓ ${result.category}`);
          successCount++;
        }
      } else {
        console.log(`  ⚠ No suggestion`);
        failCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error:`, error.message);
      failCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n✓ Categorization complete!`);
  console.log(`  Categorized: ${successCount}`);
  console.log(`  Skipped: ${failCount}`);

  await supabase.auth.signOut();
}

categorizeAllPosted().catch(console.error);
