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
  { name: "Whole Foods Market", type: "vendor", notes: "Organic grocery store" },
  { name: "Trader Joes", type: "vendor", notes: "Specialty grocery store" },
  { name: "Safeway", type: "vendor", notes: "Grocery store" },
  { name: "Kroger", type: "vendor", notes: "Grocery store" },
  { name: "Publix", type: "vendor", notes: "Grocery store" },
  { name: "Walmart", type: "vendor", notes: "Grocery and retail" },
  { name: "Target", type: "vendor", notes: "Retail department store" },
  { name: "Sprouts", type: "vendor", notes: "Farmers market grocery" },
  { name: "Aldi", type: "vendor", notes: "Discount grocery" },
  { name: "Costco", type: "vendor", notes: "Warehouse club" },
  { name: "Harris Teeter", type: "vendor", notes: "Grocery store" },
  { name: "Giant Food", type: "vendor", notes: "Grocery store" },
  { name: "Food Lion", type: "vendor", notes: "Grocery store" },
  { name: "Starbucks", type: "vendor", notes: "Coffee shop" },
  { name: "Chipotle", type: "vendor", notes: "Mexican restaurant" },
  { name: "Panera Bread", type: "vendor", notes: "Bakery cafe" },
  { name: "Subway", type: "vendor", notes: "Sandwich shop" },
  { name: "McDonalds", type: "vendor", notes: "Fast food restaurant" },
  { name: "Chick-Fil-A", type: "vendor", notes: "Fast food restaurant" },
  { name: "Olive Garden", type: "vendor", notes: "Italian restaurant" },
  { name: "Red Lobster", type: "vendor", notes: "Seafood restaurant" },
  { name: "Applebees", type: "vendor", notes: "Casual dining" },
  { name: "Chilis", type: "vendor", notes: "Casual dining" },
  { name: "Texas Roadhouse", type: "vendor", notes: "Steakhouse" },
  { name: "Outback Steakhouse", type: "vendor", notes: "Steakhouse" },
  { name: "Panda Express", type: "vendor", notes: "Chinese fast food" },
  { name: "Taco Bell", type: "vendor", notes: "Mexican fast food" },
  { name: "Dunkin", type: "vendor", notes: "Coffee and donuts" },
  { name: "Shell", type: "vendor", notes: "Gas station" },
  { name: "Chevron", type: "vendor", notes: "Gas station" },
  { name: "BP", type: "vendor", notes: "Gas station" },
  { name: "Exxon", type: "vendor", notes: "Gas station" },
  { name: "Circle K", type: "vendor", notes: "Convenience store" },
  { name: "PG&E Electric", type: "vendor", notes: "Electric utility" },
  { name: "Duke Energy", type: "vendor", notes: "Electric utility" },
  { name: "Comcast Xfinity", type: "vendor", notes: "Internet provider" },
  { name: "AT&T", type: "vendor", notes: "Internet and phone" },
  { name: "Verizon", type: "vendor", notes: "Phone service" },
  { name: "T-Mobile", type: "vendor", notes: "Phone service" },
  { name: "Netflix", type: "vendor", notes: "Streaming service" },
  { name: "Hulu", type: "vendor", notes: "Streaming service" },
  { name: "Spotify", type: "vendor", notes: "Music streaming" },
  { name: "Amazon", type: "vendor", notes: "Online shopping" },
  { name: "Best Buy", type: "vendor", notes: "Electronics retailer" },
  { name: "Home Depot", type: "vendor", notes: "Home improvement" },
  { name: "Lowes", type: "vendor", notes: "Home improvement" },
  { name: "CVS Pharmacy", type: "vendor", notes: "Pharmacy" },
  { name: "Walgreens", type: "vendor", notes: "Pharmacy" },
  { name: "Vision Center", type: "vendor", notes: "Eye care" },
  { name: "State Farm Insurance", type: "vendor", notes: "Insurance provider" },
  { name: "ACME Corporation", type: "customer", email: "payroll@acmecorp.com", notes: "Employer" },
  { name: "Freelance Client LLC", type: "customer", email: "accounting@freelanceclient.com", notes: "Consulting income" }
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
    .from('profiles')
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
      email: contact.email || null,
      phone: contact.phone || null,
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
