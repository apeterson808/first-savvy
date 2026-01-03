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
  { name: "Sams Club", type: "vendor", notes: "Warehouse club" },
  { name: "Wegmans", type: "vendor", notes: "Grocery store" },
  { name: "Harris Teeter", type: "vendor", notes: "Grocery store" },
  { name: "Giant Food", type: "vendor", notes: "Grocery store" },
  { name: "Food Lion", type: "vendor", notes: "Grocery store" },
  { name: "Starbucks", type: "vendor", notes: "Coffee shop" },
  { name: "Chipotle", type: "vendor", notes: "Mexican restaurant" },
  { name: "Panera Bread", type: "vendor", notes: "Bakery cafe" },
  { name: "Subway", type: "vendor", notes: "Sandwich shop" },
  { name: "McDonalds", type: "vendor", notes: "Fast food restaurant" },
  { name: "Chick-Fil-A", type: "vendor", notes: "Fast food restaurant" },
  { name: "Five Guys", type: "vendor", notes: "Burger restaurant" },
  { name: "In-N-Out Burger", type: "vendor", notes: "Burger restaurant" },
  { name: "Shake Shack", type: "vendor", notes: "Burger restaurant" },
  { name: "Wendys", type: "vendor", notes: "Fast food restaurant" },
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
  { name: "Mobil", type: "vendor", notes: "Gas station" },
  { name: "Arco", type: "vendor", notes: "Gas station" },
  { name: "76 Gas Station", type: "vendor", notes: "Gas station" },
  { name: "Marathon", type: "vendor", notes: "Gas station" },
  { name: "Circle K", type: "vendor", notes: "Convenience store" },
  { name: "Wawa", type: "vendor", notes: "Convenience store" },
  { name: "Speedway", type: "vendor", notes: "Convenience store" },
  { name: "PG&E Electric", type: "vendor", notes: "Electric utility" },
  { name: "Duke Energy", type: "vendor", notes: "Electric utility" },
  { name: "Southern Co Gas", type: "vendor", notes: "Gas utility" },
  { name: "Water Dept", type: "vendor", notes: "Water utility" },
  { name: "City Water Services", type: "vendor", notes: "Water utility" },
  { name: "Waste Management", type: "vendor", notes: "Waste disposal" },
  { name: "Republic Services", type: "vendor", notes: "Waste disposal" },
  { name: "Comcast Xfinity", type: "vendor", notes: "Internet provider" },
  { name: "AT&T Internet", type: "vendor", notes: "Internet provider" },
  { name: "Verizon Fios", type: "vendor", notes: "Internet provider" },
  { name: "Spectrum", type: "vendor", notes: "Internet provider" },
  { name: "Cox Internet", type: "vendor", notes: "Internet provider" },
  { name: "Verizon Wireless", type: "vendor", notes: "Phone service" },
  { name: "AT&T Mobility", type: "vendor", notes: "Phone service" },
  { name: "T-Mobile", type: "vendor", notes: "Phone service" },
  { name: "Sprint", type: "vendor", notes: "Phone service" },
  { name: "Netflix", type: "vendor", notes: "Streaming service" },
  { name: "Hulu", type: "vendor", notes: "Streaming service" },
  { name: "Disney Plus", type: "vendor", notes: "Streaming service" },
  { name: "HBO Max", type: "vendor", notes: "Streaming service" },
  { name: "Amazon Prime", type: "vendor", notes: "Subscription service" },
  { name: "Spotify", type: "vendor", notes: "Music streaming" },
  { name: "Apple Music", type: "vendor", notes: "Music streaming" },
  { name: "YouTube Premium", type: "vendor", notes: "Video streaming" },
  { name: "Peloton", type: "vendor", notes: "Fitness subscription" },
  { name: "Planet Fitness", type: "vendor", notes: "Gym membership" },
  { name: "LA Fitness", type: "vendor", notes: "Gym membership" },
  { name: "Adobe Creative", type: "vendor", notes: "Software subscription" },
  { name: "Dropbox", type: "vendor", notes: "Cloud storage" },
  { name: "Amazon", type: "vendor", notes: "Online shopping" },
  { name: "Best Buy", type: "vendor", notes: "Electronics retailer" },
  { name: "Home Depot", type: "vendor", notes: "Home improvement" },
  { name: "Lowes", type: "vendor", notes: "Home improvement" },
  { name: "Kohls", type: "vendor", notes: "Department store" },
  { name: "Nordstrom", type: "vendor", notes: "Department store" },
  { name: "Macys", type: "vendor", notes: "Department store" },
  { name: "Bed Bath Beyond", type: "vendor", notes: "Home goods" },
  { name: "IKEA", type: "vendor", notes: "Furniture store" },
  { name: "Wayfair", type: "vendor", notes: "Online furniture" },
  { name: "Etsy", type: "vendor", notes: "Online marketplace" },
  { name: "Ebay", type: "vendor", notes: "Online marketplace" },
  { name: "AMC Theatres", type: "vendor", notes: "Movie theater" },
  { name: "Regal Cinemas", type: "vendor", notes: "Movie theater" },
  { name: "Ticketmaster", type: "vendor", notes: "Event tickets" },
  { name: "Stubhub", type: "vendor", notes: "Event tickets" },
  { name: "Dave & Busters", type: "vendor", notes: "Entertainment venue" },
  { name: "Top Golf", type: "vendor", notes: "Entertainment venue" },
  { name: "Bowling Alley", type: "vendor", notes: "Entertainment venue" },
  { name: "Mini Golf", type: "vendor", notes: "Entertainment venue" },
  { name: "CVS Pharmacy", type: "vendor", notes: "Pharmacy" },
  { name: "Walgreens", type: "vendor", notes: "Pharmacy" },
  { name: "Rite Aid", type: "vendor", notes: "Pharmacy" },
  { name: "Kaiser Permanente", type: "vendor", notes: "Healthcare" },
  { name: "Urgent Care", type: "vendor", notes: "Healthcare" },
  { name: "Dental Office", type: "vendor", notes: "Healthcare" },
  { name: "Vision Center", type: "vendor", notes: "Eye care" },
  { name: "Quest Diagnostics", type: "vendor", notes: "Medical lab" },
  { name: "State Farm Insurance", type: "vendor", notes: "Insurance provider" },
  { name: "Geico", type: "vendor", notes: "Insurance provider" },
  { name: "Allstate", type: "vendor", notes: "Insurance provider" },
  { name: "Progressive", type: "vendor", notes: "Insurance provider" },
  { name: "USAA Insurance", type: "vendor", notes: "Insurance provider" },
  { name: "Health Insurance Co", type: "vendor", notes: "Insurance provider" },
  { name: "ACE Hardware", type: "vendor", notes: "Hardware store" },
  { name: "Lawn Service", type: "vendor", notes: "Home maintenance" },
  { name: "Pest Control", type: "vendor", notes: "Home maintenance" },
  { name: "HVAC Repair", type: "vendor", notes: "Home maintenance" },
  { name: "Plumber", type: "vendor", notes: "Home maintenance" },
  { name: "Electrician", type: "vendor", notes: "Home maintenance" },
  { name: "Jiffy Lube", type: "vendor", notes: "Auto maintenance" },
  { name: "Pep Boys", type: "vendor", notes: "Auto parts" },
  { name: "Autozone", type: "vendor", notes: "Auto parts" },
  { name: "Oreilly Auto", type: "vendor", notes: "Auto parts" },
  { name: "Car Wash", type: "vendor", notes: "Auto service" },
  { name: "Tire Center", type: "vendor", notes: "Auto service" },
  { name: "Oil Change", type: "vendor", notes: "Auto service" },
  { name: "Southwest Airlines", type: "vendor", notes: "Airline" },
  { name: "United Airlines", type: "vendor", notes: "Airline" },
  { name: "Delta Airlines", type: "vendor", notes: "Airline" },
  { name: "Marriott Hotels", type: "vendor", notes: "Hotel" },
  { name: "Hilton Hotels", type: "vendor", notes: "Hotel" },
  { name: "Airbnb", type: "vendor", notes: "Short-term rental" },
  { name: "Expedia", type: "vendor", notes: "Travel booking" },
  { name: "Uber", type: "vendor", notes: "Ride sharing" },
  { name: "Lyft", type: "vendor", notes: "Ride sharing" },
  { name: "Rental Car", type: "vendor", notes: "Car rental" },
  { name: "Petsmart", type: "vendor", notes: "Pet supplies" },
  { name: "Petco", type: "vendor", notes: "Pet supplies" },
  { name: "Chewy.com", type: "vendor", notes: "Pet supplies online" },
  { name: "Vet Clinic", type: "vendor", notes: "Veterinary services" },
  { name: "Pet Grooming", type: "vendor", notes: "Pet services" },
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
