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
    console.error('Error reading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data } = await supabase
  .from('statement_cache')
  .select('institution_name, file_name, transaction_count, statement_month, statement_year, total_debits, total_credits')
  .order('institution_name', { ascending: true })
  .order('statement_year', { ascending: true })
  .order('statement_month', { ascending: true });

console.log('\n' + '='.repeat(70));
console.log('STATEMENT CACHE VERIFICATION');
console.log('='.repeat(70) + '\n');

const byInstitution = data.reduce((acc, row) => {
  if (!acc[row.institution_name]) acc[row.institution_name] = [];
  acc[row.institution_name].push(row);
  return acc;
}, {});

Object.entries(byInstitution).forEach(([inst, statements]) => {
  console.log(`${inst}:`);
  console.log('-'.repeat(70));
  statements.forEach(s => {
    const month = s.statement_month?.toUpperCase().padEnd(4);
    const txCount = String(s.transaction_count).padStart(3);
    const debits = parseFloat(s.total_debits || 0).toFixed(2).padStart(10);
    const credits = parseFloat(s.total_credits || 0).toFixed(2).padStart(10);
    console.log(`  ${month} ${s.statement_year}: ${txCount} tx | Debits: $${debits} | Credits: $${credits}`);
  });
  console.log();
});

console.log('='.repeat(70));
console.log(`Total Statements: ${data.length}`);
console.log('='.repeat(70) + '\n');
