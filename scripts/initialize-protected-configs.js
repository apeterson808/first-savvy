import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
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
}

const env = loadEnvFile();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function generateHash(content) {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

async function initializeProtectedConfigurations() {
  console.log('Initializing protected configurations...\n');

  const categoryDropdownPath = path.join(__dirname, '../src/components/common/CategoryDropdown.jsx');
  const constantsPath = path.join(__dirname, '../src/components/utils/constants.jsx');

  const categoryDropdownContent = fs.readFileSync(categoryDropdownPath, 'utf-8');
  const constantsContent = fs.readFileSync(constantsPath, 'utf-8');

  const categorySystemConfig = {
    name: 'category_dropdown_system',
    description: 'Category Dropdown Component and Related Constants - This configuration is protected and changes require explicit confirmation',
    version: '1.0.0',
    configuration_data: {
      categoryDropdownComponent: categoryDropdownContent,
      constants: constantsContent,
      protectedConstants: [
        'DETAIL_TYPE_LABELS',
        'DEFAULT_DETAIL_TYPES',
        'getAccountDisplayName',
        'getDetailTypeDisplayName'
      ],
      filteringLogic: {
        description: 'Category filtering logic for income/expense',
        transferHandling: 'Categories with detail_type=transfer are handled separately',
        incomeExpenseFiltering: 'Non-transfer categories filtered by type matching transactionType'
      }
    },
    file_paths: [
      'src/components/common/CategoryDropdown.jsx',
      'src/components/utils/constants.jsx'
    ],
    is_locked: true
  };

  const hash = generateHash(categorySystemConfig.configuration_data);

  try {
    const { data: existingConfig } = await supabase
      .from('protected_configurations')
      .select('id, version')
      .eq('name', categorySystemConfig.name)
      .maybeSingle();

    if (existingConfig) {
      console.log(`✓ Configuration '${categorySystemConfig.name}' already exists (version ${existingConfig.version})`);
      console.log('  Skipping initialization.');
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    let userId = authData?.session?.user?.id;

    if (!userId) {
      console.log('No authenticated user found. Using service role for initialization...');
      const { data: users } = await supabase.auth.admin.listUsers();
      if (users && users.users && users.users.length > 0) {
        userId = users.users[0].id;
      }
    }

    const { data, error } = await supabase
      .from('protected_configurations')
      .insert({
        name: categorySystemConfig.name,
        description: categorySystemConfig.description,
        version: categorySystemConfig.version,
        content_hash: hash,
        configuration_data: categorySystemConfig.configuration_data,
        file_paths: categorySystemConfig.file_paths,
        is_locked: categorySystemConfig.is_locked,
        is_active: true,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating protected configuration:', error.message);
      throw error;
    }

    console.log(`✓ Successfully created protected configuration: ${data.name}`);
    console.log(`  Version: ${data.version}`);
    console.log(`  Hash: ${data.content_hash}`);
    console.log(`  Locked: ${data.is_locked}`);
    console.log(`  Protected files:`);
    data.file_paths.forEach(filePath => {
      console.log(`    - ${filePath}`);
    });

    console.log('\n✓ Protected configuration initialized successfully!');
    console.log('\nIMPORTANT: Any changes to the following files will now require explicit confirmation:');
    data.file_paths.forEach(filePath => {
      console.log(`  - ${filePath}`);
    });

  } catch (error) {
    console.error('Failed to initialize protected configurations:', error);
    process.exit(1);
  }
}

initializeProtectedConfigurations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
