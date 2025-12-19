import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function suggestContacts() {
  console.log('Fetching transactions without contact suggestions...');

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, description, type, contact_id')
    .is('ai_suggested_contact_id', null)
    .neq('type', 'transfer')
    .not('description', 'is', null)
    .limit(50);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    return;
  }

  console.log(`Found ${transactions.length} transactions needing contact suggestions`);

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('status', 'active');

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError);
    return;
  }

  console.log(`Found ${contacts.length} active contacts`);

  const { data: rules, error: rulesError } = await supabase
    .from('contact_matching_rules')
    .select('id, name, contact_id, match_type, match_value, priority, is_active')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (rulesError) {
    console.error('Error fetching contact matching rules:', rulesError);
    return;
  }

  console.log(`Found ${rules.length} active matching rules`);

  if (contacts.length === 0) {
    console.log('No contacts available for matching');
    return;
  }

  let processed = 0;
  let matched = 0;
  let backfilled = 0;

  for (const tx of transactions) {
    console.log(`\nProcessing: ${tx.description}`);

    try {
      let suggestedContactId = null;
      let source = null;

      if (tx.contact_id) {
        const descLower = tx.description.toLowerCase().trim();

        for (const rule of rules) {
          const matchVal = rule.match_value.toLowerCase();
          let matches = false;

          switch (rule.match_type) {
            case 'exact':
              matches = descLower === matchVal;
              break;
            case 'starts_with':
              matches = descLower.startsWith(matchVal);
              break;
            case 'ends_with':
              matches = descLower.endsWith(matchVal);
              break;
            case 'contains':
            default:
              matches = descLower.includes(matchVal);
              break;
          }

          if (matches && rule.contact_id === tx.contact_id) {
            suggestedContactId = tx.contact_id;
            source = `backfill (rule: ${rule.name})`;
            break;
          }
        }

        if (suggestedContactId) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              ai_suggested_contact_id: suggestedContactId
            })
            .eq('id', tx.id);

          if (updateError) {
            console.error(`  ✗ Update failed:`, updateError);
          } else {
            const contact = contacts.find(c => c.id === suggestedContactId);
            console.log(`  ✓ Backfilled contact: ${contact?.name || suggestedContactId} (${source})`);
            backfilled++;
            matched++;
          }
          processed++;
          continue;
        }
      }

      const descLower = tx.description.toLowerCase().trim();

      for (const rule of rules) {
        const matchVal = rule.match_value.toLowerCase();
        let matches = false;

        switch (rule.match_type) {
          case 'exact':
            matches = descLower === matchVal;
            break;
          case 'starts_with':
            matches = descLower.startsWith(matchVal);
            break;
          case 'ends_with':
            matches = descLower.endsWith(matchVal);
            break;
          case 'contains':
          default:
            matches = descLower.includes(matchVal);
            break;
        }

        if (matches) {
          suggestedContactId = rule.contact_id;
          source = `rule: ${rule.name}`;
          break;
        }
      }

      if (!suggestedContactId) {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/ai-suggest-contact`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: tx.description,
              contacts: contacts,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`  ✗ API error:`, errorText);
          continue;
        }

        const result = await response.json();

        if (result.contactId) {
          suggestedContactId = result.contactId;
          source = 'AI';
        }
      }

      if (suggestedContactId) {
        const contact = contacts.find(c => c.id === suggestedContactId);

        if (contact) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              ai_suggested_contact_id: contact.id
            })
            .eq('id', tx.id);

          if (updateError) {
            console.error(`  ✗ Update failed:`, updateError);
          } else {
            console.log(`  ✓ Suggested contact: ${contact.name} (${source})`);
            matched++;
          }
        }
      } else {
        console.log(`  - No matching contact found`);
      }

      processed++;

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ✗ Error:`, error.message);
    }
  }

  console.log(`\n✅ Processing complete!`);
  console.log(`   Processed: ${processed}/${transactions.length}`);
  console.log(`   Matched: ${matched}/${transactions.length}`);
  console.log(`   Backfilled: ${backfilled}/${transactions.length}`);
}

suggestContacts().catch(console.error);
