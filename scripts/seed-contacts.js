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

const sampleContacts = [
  {
    name: "Amazon",
    type: "vendor",
    email: "orders@amazon.com",
    phone: "1-888-280-4331",
    notes: "Online shopping and retail"
  },
  {
    name: "Starbucks Coffee",
    type: "vendor",
    email: "info@starbucks.com",
    phone: "1-800-782-7282",
    notes: "Coffee shop chain"
  },
  {
    name: "Whole Foods Market",
    type: "vendor",
    email: null,
    phone: null,
    notes: "Organic grocery store"
  },
  {
    name: "Shell Gas Station",
    type: "vendor",
    email: null,
    phone: null,
    notes: "Fuel and convenience store"
  },
  {
    name: "Netflix",
    type: "vendor",
    email: "info@netflix.com",
    phone: "1-866-579-7172",
    notes: "Streaming service subscription"
  },
  {
    name: "AT&T Wireless",
    type: "vendor",
    email: "support@att.com",
    phone: "1-800-331-0500",
    notes: "Mobile phone service provider"
  },
  {
    name: "ComEd Electric",
    type: "vendor",
    email: "customerservice@comed.com",
    phone: "1-800-334-7661",
    notes: "Electric utility company"
  },
  {
    name: "Target Corporation",
    type: "vendor",
    email: null,
    phone: "1-800-440-0680",
    notes: "Retail department store"
  },
  {
    name: "Uber Technologies",
    type: "vendor",
    email: "support@uber.com",
    phone: null,
    notes: "Ride sharing service"
  },
  {
    name: "Chevron Gas",
    type: "vendor",
    email: null,
    phone: null,
    notes: "Gas station and convenience store"
  },
  {
    name: "Apple Inc.",
    type: "vendor",
    email: "support@apple.com",
    phone: "1-800-275-2273",
    notes: "Technology and iTunes purchases"
  },
  {
    name: "Costco Wholesale",
    type: "vendor",
    email: null,
    phone: "1-800-774-2678",
    notes: "Warehouse club membership"
  },
  {
    name: "Chipotle Mexican Grill",
    type: "vendor",
    email: null,
    phone: null,
    notes: "Fast casual restaurant"
  },
  {
    name: "Spotify",
    type: "vendor",
    email: "support@spotify.com",
    phone: null,
    notes: "Music streaming subscription"
  },
  {
    name: "CVS Pharmacy",
    type: "vendor",
    email: null,
    phone: "1-800-746-7287",
    notes: "Pharmacy and retail"
  },
  {
    name: "Verizon Wireless",
    type: "vendor",
    email: "support@verizon.com",
    phone: "1-800-922-0204",
    notes: "Mobile and internet service"
  },
  {
    name: "Trader Joe's",
    type: "vendor",
    email: null,
    phone: null,
    notes: "Specialty grocery store"
  },
  {
    name: "Adobe Creative Cloud",
    type: "vendor",
    email: "support@adobe.com",
    phone: "1-800-833-6687",
    notes: "Software subscription"
  },
  {
    name: "ACME Corporation",
    type: "customer",
    email: "payroll@acmecorp.com",
    phone: "1-555-123-4567",
    notes: "Employer - monthly salary"
  },
  {
    name: "Freelance Client LLC",
    type: "customer",
    email: "accounting@freelanceclient.com",
    phone: "1-555-987-6543",
    notes: "Consulting income"
  }
];

async function seedContacts() {
  console.log('\n🌱 Starting contacts seeding process...\n');

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('❌ Error: You must be logged in to seed contacts');
    console.error('Please sign in to the application first');
    process.exit(1);
  }

  console.log(`✓ Authenticated as: ${user.email}`);

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    console.error('❌ Error: No profile found for user');
    console.error('Please complete onboarding first');
    process.exit(1);
  }

  const profileId = profiles[0].id;
  console.log(`✓ Found profile: ${profileId}\n`);

  console.log('📝 Inserting contacts...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const contact of sampleContacts) {
    const contactData = {
      user_id: user.id,
      profile_id: profileId,
      name: contact.name,
      type: contact.type,
      email: contact.email,
      phone: contact.phone,
      notes: contact.notes,
      status: 'active',
      connection_status: 'not_checked'
    };

    const { error } = await supabase
      .from('contacts')
      .insert(contactData);

    if (error) {
      console.error(`  ❌ Failed to insert ${contact.name}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✓ Added ${contact.name}`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully added ${successCount} contacts`);
  if (errorCount > 0) {
    console.log(`❌ Failed to add ${errorCount} contacts`);
  }
  console.log('='.repeat(50) + '\n');
}

seedContacts().catch(console.error);
