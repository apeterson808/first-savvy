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
const supabase = createClient(supabaseUrl, supabaseKey);

async function autoCategorizePostedTransactions() {
  console.log('Fetching uncategorized posted transactions...');

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, description, amount, type, status')
    .eq('status', 'posted')
    .is('chart_account_id', null);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  console.log(`Found ${transactions.length} uncategorized posted transactions`);

  if (transactions.length === 0) {
    console.log('\n✓ No transactions to categorize!');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('No active session. Please log in first.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const tx of transactions) {
    console.log(`\nProcessing: ${tx.description} ($${tx.amount})`);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-categorize-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: tx.description,
            amount: tx.amount,
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
        console.log(`  → Suggested: ${result.category} (${result.confidence})`);

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
          console.log(`  ✓ Category set to: ${result.category}`);
          successCount++;
        }
      } else {
        console.log(`  ⚠ No category suggestion available`);
        failCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error:`, error.message);
      failCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✓ Auto-categorization complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
}

autoCategorizePostedTransactions().catch(console.error);
