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

async function autoCategorizeTransactions() {
  console.log('Fetching uncategorized transactions...');

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, description, amount, type')
    .is('category_id', null);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  console.log(`Found ${transactions.length} uncategorized transactions`);

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, type');

  if (catError) {
    console.error('Error fetching categories:', catError);
    return;
  }

  const categoryMap = new Map();
  categories.forEach(cat => {
    categoryMap.set(cat.name.toLowerCase(), cat);
  });

  for (const tx of transactions) {
    console.log(`\nProcessing: ${tx.description} ($${tx.amount})`);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-categorize-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: tx.description,
            amount: tx.amount,
          }),
        }
      );

      const result = await response.json();

      if (result.category) {
        const category = categoryMap.get(result.category.toLowerCase());

        if (category) {
          console.log(`  → Suggested: ${result.category} (${result.confidence})`);

          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              ai_suggested_category_id: category.id,
              category_id: category.id
            })
            .eq('id', tx.id);

          if (updateError) {
            console.error(`  ✗ Update failed:`, updateError);
          } else {
            console.log(`  ✓ Category set to: ${category.name}`);
          }
        } else {
          console.log(`  ✗ Category not found in database: ${result.category}`);
        }
      } else if (result.fallback) {
        const category = categoryMap.get(result.fallback.category.toLowerCase());

        if (category) {
          console.log(`  → Fallback: ${result.fallback.category}`);

          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              ai_suggested_category_id: category.id,
              category_id: category.id
            })
            .eq('id', tx.id);

          if (updateError) {
            console.error(`  ✗ Update failed:`, updateError);
          } else {
            console.log(`  ✓ Category set to: ${category.name}`);
          }
        }
      } else {
        console.log(`  ✗ No category suggestion received`);
      }
    } catch (error) {
      console.error(`  ✗ Error:`, error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✓ Auto-categorization complete!');
}

autoCategorizeTransactions().catch(console.error);
