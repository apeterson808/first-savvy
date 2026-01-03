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
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const statements = {
  'citi_sep.pdf': {
    month: 'sep',
    year: 2025,
    period: '08/19/25-09/16/25',
    transactions: [
      { date: '2025-08-19', description: 'Prime Video Channels amzn.com/billWA', amount: 2.99, type: 'expense' },
      { date: '2025-08-19', description: 'SQ *KEVISTA COFFEE - EAGLEagle ID', amount: 29.09, type: 'expense' },
      { date: '2025-08-19', description: 'SQ *FUSION SYNC SOLUTIONSgosq.com TX', amount: 1926.00, type: 'expense' },
      { date: '2025-08-19', description: 'DEAD ON ARCHERY - EAGLE BOISE ID', amount: 134.47, type: 'expense' },
      { date: '2025-08-19', description: 'AMAZON MKTPL*YV2U804Z3 Amzn.com/billWA', amount: 37.63, type: 'expense' },
      { date: '2025-08-19', description: 'Amazon.com*WJ81U5W53 Amzn.com/billWA', amount: 300.00, type: 'expense' },
      { date: '2025-08-19', description: 'SQ *FORM & FUNCTION COFFEEagle ID', amount: 19.02, type: 'expense' },
      { date: '2025-08-19', description: 'IC* INSTACART 888-2467822 CA', amount: 140.84, type: 'expense' },
      { date: '2025-08-20', description: 'IN *TAILOREDCLOSET AND PR208-6000668 ID', amount: 7504.46, type: 'expense' },
      { date: '2025-08-20', description: 'SQ *FORM & FUNCTION COFFEEagle ID', amount: 15.74, type: 'expense' },
      { date: '2025-08-20', description: 'Amazon.com*CP5RO7MQ3 Amzn.com/billWA', amount: 42.92, type: 'expense' },
      { date: '2025-08-21', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 228.08, type: 'expense' },
      { date: '2025-08-21', description: 'SQ *BFC STATE STREET Boise ID', amount: 18.20, type: 'expense' },
      { date: '2025-08-22', description: 'LS REED CYCLE INC 120-89387894 ID', amount: 175.86, type: 'expense' },
      { date: '2025-08-22', description: 'SHELL OIL10007548018 CASCADE ID', amount: 2.99, type: 'expense' },
      { date: '2025-08-22', description: 'Sonora Mexican RestaurantHorseshoe BenID', amount: 22.88, type: 'expense' },
      { date: '2025-08-22', description: 'FRED MEYER #0685 MERIDIAN ID', amount: 70.94, type: 'expense' },
      { date: '2025-08-22', description: 'Amazon.com*LD46J8KN3 Amzn.com/billWA', amount: 26.62, type: 'expense' },
      { date: '2025-08-22', description: 'IC* COSTCO BY IN CAR 8882467822 CA', amount: 10.48, type: 'income' },
      { date: '2025-08-23', description: 'CHEVRON 0207587 HORSESHOE BENID', amount: 1.90, type: 'expense' },
      { date: '2025-08-23', description: 'SQ *THE. ODD DUCK Cascade ID', amount: 7.42, type: 'expense' },
      { date: '2025-08-23', description: 'TST*SALMON RIVER BREWERY McCall ID', amount: 25.40, type: 'expense' },
      { date: '2025-08-23', description: 'Store Cascade ID', amount: 8.34, type: 'expense' },
      { date: '2025-08-24', description: 'SQ *THE. ODD DUCK Cascade ID', amount: 6.35, type: 'expense' },
      { date: '2025-08-24', description: 'CHEVRON 0205133 BOISE ID', amount: 94.60, type: 'expense' },
      { date: '2025-08-25', description: 'IC* INSTACART 888-246-7822 CA', amount: 181.58, type: 'expense' },
      { date: '2025-08-25', description: 'EVOLUTION INTEGRATIVE MEDEAGLE ID', amount: 200.00, type: 'expense' },
      { date: '2025-08-25', description: 'AMAZON PRIME*0T1UH2KV3 amzn.com/billWA', amount: 2.99, type: 'expense' },
      { date: '2025-08-26', description: 'AMAZON MKTPL*P36BW9VA3 Amzn.com/billWA', amount: 45.57, type: 'expense' },
      { date: '2025-08-27', description: 'READ WITH ELLO ELLO.COM CA', amount: 14.99, type: 'expense' },
      { date: '2025-08-27', description: 'EVOLUTION INTEGRATIVE MEDEAGLE ID', amount: 1269.00, type: 'expense' },
      { date: '2025-08-27', description: 'TST*CAFFEINA - JOVINOS Eagle ID', amount: 17.50, type: 'expense' },
      { date: '2025-08-28', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 11.85, type: 'expense' },
      { date: '2025-08-28', description: 'AMAZON MKTPL*XQ7QT6AB3 Amzn.com/billWA', amount: 49.79, type: 'expense' },
      { date: '2025-08-28', description: 'AMAZON MKTPL*XB6BM8W43 Amzn.com/billWA', amount: 56.16, type: 'expense' },
      { date: '2025-08-29', description: 'SQ *MOJO?S DONUTS, COFFEEEagle ID', amount: 19.02, type: 'expense' },
      { date: '2025-08-30', description: 'MCDONALD\'S F19731 EAGLE ID', amount: 42.00, type: 'expense' },
      { date: '2025-08-31', description: 'GOLDYS CORNER BOISE ID', amount: 31.21, type: 'expense' },
      { date: '2025-08-31', description: 'DIAMOND PARKING parkmobilecomWA', amount: 6.00, type: 'expense' },
      { date: '2025-09-01', description: 'IC* INSTACART INSTACART.COMCA', amount: 339.12, type: 'expense' },
      { date: '2025-09-02', description: 'IC* INSTACART INSTACART.COMCA', amount: 147.99, type: 'expense' },
      { date: '2025-09-02', description: 'USPS CHANGE OF ADDRESS 800-238-3150 TN', amount: 1.25, type: 'expense' },
      { date: '2025-09-02', description: 'Amazon.com*R18EC8VG3 Amzn.com/billWA', amount: 12.17, type: 'expense' },
      { date: '2025-09-02', description: 'AMAZON MKTPL*LB2CS8B63 Amzn.com/billWA', amount: 20.13, type: 'expense' },
      { date: '2025-09-02', description: 'AMAZON MKTPL*NC49H6U63 Amzn.com/billWA', amount: 25.43, type: 'expense' },
      { date: '2025-09-02', description: 'ONLINE PAYMENT, THANK YOU', amount: 1905.00, type: 'income' },
      { date: '2025-09-02', description: 'ONLINE PAYMENT, THANK YOU', amount: 12000.00, type: 'income' },
      { date: '2025-09-03', description: 'AMAZON MKTPL*PU5UA8KG3 Amzn.com/billWA', amount: 9.53, type: 'expense' },
      { date: '2025-09-03', description: 'TST*CAFFIENA RANCH Boise ID', amount: 5.57, type: 'expense' },
      { date: '2025-09-03', description: 'AMAZON MKTPL*YA5QX4U53 Amzn.com/billWA', amount: 25.43, type: 'expense' },
      { date: '2025-09-04', description: 'PY *WEST ADA SCHOOL DISTR916-467-4700 ID', amount: 103.95, type: 'expense' },
      { date: '2025-09-04', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 3.91, type: 'expense' },
      { date: '2025-09-04', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 38.21, type: 'expense' },
      { date: '2025-09-04', description: 'AMAZON MKTPL*PN7ZX9HF3 Amzn.com/billWA', amount: 428.35, type: 'expense' },
      { date: '2025-09-04', description: 'Amazon.com*QA4CP3283 Amzn.com/billWA', amount: 153.62, type: 'expense' },
      { date: '2025-09-04', description: 'Amazon.com*4T8GC39R3 Amzn.com/billWA', amount: 474.87, type: 'expense' },
      { date: '2025-09-04', description: 'STARBUCKS STORE 08831 MERIDIAN ID', amount: 10.07, type: 'expense' },
      { date: '2025-09-04', description: 'MALANG PEST CONTROL INC 949-9223099 CA', amount: 150.00, type: 'expense' },
      { date: '2025-09-05', description: 'IC* INSTACART 888-246-7822 CA', amount: 18.74, type: 'expense' },
      { date: '2025-09-05', description: 'IC* INSTACART 888-246-7822 CA', amount: 47.87, type: 'expense' },
      { date: '2025-09-05', description: 'IC* INSTACART 888-246-7822 CA', amount: 49.19, type: 'expense' },
      { date: '2025-09-05', description: 'IC* INSTACART 888-246-7822 CA', amount: 51.96, type: 'expense' },
      { date: '2025-09-05', description: 'IC* INSTACART 888-246-7822 CA', amount: 182.22, type: 'expense' },
      { date: '2025-09-05', description: 'GARDEN STATE HEALTHCARE A201-8218881 NJ', amount: 1612.75, type: 'expense' },
      { date: '2025-09-06', description: 'IC* INSTACART 888-246-7822 CA', amount: 25.34, type: 'expense' },
      { date: '2025-09-06', description: 'IC* INSTACART 888-246-7822 CA', amount: 91.28, type: 'expense' },
      { date: '2025-09-06', description: 'STARBUCKS 03236 EAGLE ID', amount: 13.83, type: 'expense' },
      { date: '2025-09-06', description: 'TM *NATE BARGATZE 800-653-8000 CA', amount: 174.48, type: 'expense' },
      { date: '2025-09-06', description: 'Amazon.com*UE2A04KR3 Amzn.com/billWA', amount: 211.95, type: 'expense' },
      { date: '2025-09-06', description: 'COSTCO GAS #1343 MERIDIAN ID', amount: 56.24, type: 'expense' },
      { date: '2025-09-08', description: 'IC* INSTACART 888-246-7822 CA', amount: 174.16, type: 'expense' },
      { date: '2025-09-08', description: 'IC* INSTACART 8882467822 CA', amount: 6.35, type: 'income' },
      { date: '2025-09-08', description: 'AIR1 888-937-2471 CA', amount: 15.00, type: 'expense' },
      { date: '2025-09-08', description: 'AMAZON MKTPL*0K8IT0RH3 Amzn.com/billWA', amount: 57.23, type: 'expense' },
      { date: '2025-09-09', description: 'SP PLANTPAPER PLANTPAPER.USNY', amount: 150.00, type: 'expense' },
      { date: '2025-09-10', description: 'ONLINE PAYMENT, THANK YOU', amount: 2000.00, type: 'income' },
      { date: '2025-09-10', description: 'ONLINE PAYMENT, THANK YOU', amount: 2567.58, type: 'income' },
      { date: '2025-09-11', description: 'AMAZON MKTPL*471CX5FN3 Amzn.com/billWA', amount: 41.31, type: 'expense' },
      { date: '2025-09-11', description: 'STARBUCKS STORE 03236 EAGLE ID', amount: 3.82, type: 'expense' },
      { date: '2025-09-11', description: 'TST*PAPA KELSEYS - EAGLE Eagle ID', amount: 12.12, type: 'expense' },
      { date: '2025-09-11', description: 'SHERWIN-WILLIAMS708246 EAGLE ID', amount: 52.95, type: 'expense' },
      { date: '2025-09-12', description: 'IC* INSTACART INSTACART.COMCA', amount: 183.86, type: 'expense' },
      { date: '2025-09-12', description: 'SQ *MOJO?S DONUTS, COFFEEEagle ID', amount: 15.78, type: 'expense' },
      { date: '2025-09-12', description: 'AMAZON MKTPL*BB2LJ64G3 Amzn.com/billWA', amount: 29.67, type: 'expense' },
      { date: '2025-09-12', description: 'MALANG PEST CONTROL INC 949-9223099 CA', amount: 150.00, type: 'expense' },
      { date: '2025-09-12', description: 'DEAD ON ARCHERY - EAGLE BOISE ID', amount: 47.69, type: 'expense' },
      { date: '2025-09-12', description: 'IC* INSTACART 888-2467822 CA', amount: 25.13, type: 'expense' },
      { date: '2025-09-12', description: 'IC* INSTACART 888-2467822 CA', amount: 154.81, type: 'expense' },
      { date: '2025-09-12', description: 'NORTHWEST PETS EAGLE EAGLE ID', amount: 18.00, type: 'expense' },
      { date: '2025-09-15', description: 'CONOCO - COUNTRY STORE SARATOGA WY', amount: 4.02, type: 'expense' },
      { date: '2025-09-15', description: 'SQ *COZY COFFEE Heyburn ID', amount: 7.36, type: 'expense' },
      { date: '2025-09-15', description: 'LOVE\'S #0888 INSIDE GREEN RIVER WY', amount: 16.61, type: 'expense' },
      { date: '2025-09-16', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 261.34, type: 'expense' },
      { date: '2025-09-16', description: 'AMAZON MKTPLACE PMTS Amzn.com/billWA', amount: 20.13, type: 'income' },
      { date: '2025-09-16', description: 'Amazon.com Amzn.com/billWA', amount: 153.62, type: 'income' }
    ]
  },
  'citi_oct.pdf': {
    month: 'oct',
    year: 2025,
    period: '09/17/25-10/16/25',
    transactions: [
      { date: '2025-09-17', description: 'Amazon.com*ZR3M36KJ3 Amzn.com/billWA', amount: 36.80, type: 'expense' },
      { date: '2025-09-18', description: 'Kindle Svcs*IT95Z5ID3 888-802-3080 WA', amount: 3.99, type: 'expense' },
      { date: '2025-09-18', description: 'Prime Video Channels amzn.com/billWA', amount: 5.99, type: 'expense' },
      { date: '2025-09-19', description: 'Amazon.com*PP5X37RP3 Amzn.com/billWA', amount: 15.89, type: 'expense' },
      { date: '2025-09-20', description: 'MICROSOFT*MICROSOFT 36 MICROSOFT.COMWA', amount: 129.99, type: 'expense' },
      { date: '2025-09-20', description: 'IC* INSTACART 888-246-7822 CA', amount: 181.64, type: 'expense' },
      { date: '2025-09-21', description: 'AMAZON MKTPL*7T93F83H3 Amzn.com/billWA', amount: 21.17, type: 'expense' },
      { date: '2025-09-21', description: 'AMAZON MKTPL*0X4RQ2DL3 Amzn.com/billWA', amount: 46.63, type: 'expense' },
      { date: '2025-09-21', description: 'AMAZON MKTPL*OQ98K93I3 Amzn.com/billWA', amount: 67.18, type: 'expense' },
      { date: '2025-09-21', description: 'NORTH PARK MEATS WALDEN CO', amount: 778.39, type: 'expense' },
      { date: '2025-09-22', description: 'AMAZON MKTPL*JT3II8P03 Amzn.com/billWA', amount: 42.38, type: 'expense' },
      { date: '2025-09-23', description: 'Amazon.com*PN77Z8IE3 Amzn.com/billWA', amount: 25.43, type: 'expense' },
      { date: '2025-09-23', description: 'Amazon.com*P25PO2GR3 Amzn.com/billWA', amount: 40.16, type: 'expense' },
      { date: '2025-09-24', description: 'AMAZON MKTPL*KQ7XR7MW3 Amzn.com/billWA', amount: 23.30, type: 'expense' },
      { date: '2025-09-24', description: 'Amazon.com*5W00H8LS3 Amzn.com/billWA', amount: 9.53, type: 'expense' },
      { date: '2025-09-24', description: 'Amazon.com*NJ7BN6PT0 Amzn.com/billWA', amount: 10.59, type: 'expense' },
      { date: '2025-09-24', description: 'AMAZON MKTPL*Q78MM9353 Amzn.com/billWA', amount: 26.48, type: 'expense' },
      { date: '2025-09-25', description: 'SCOUT MOTORS INC. SCOUTMOTORS.CVA', amount: 100.00, type: 'expense' },
      { date: '2025-09-25', description: 'FUSION SYNC SOLUTIONS FUSIONSYNCLABTX', amount: 3925.00, type: 'expense' },
      { date: '2025-09-25', description: 'AMAZON PRIME*NJ36T55D0 amzn.com/billWA', amount: 2.99, type: 'expense' },
      { date: '2025-09-25', description: 'Amazon.com*HA8O66PZ3 Amzn.com/billWA', amount: 42.39, type: 'expense' },
      { date: '2025-09-25', description: 'Amazon.com*NJ5R73MJ0 Amzn.com/billWA', amount: 323.21, type: 'expense' },
      { date: '2025-09-25', description: 'ONLINE PAYMENT, THANK YOU', amount: 2221.00, type: 'income' },
      { date: '2025-09-26', description: 'SCOUT MOTORS INC. SCOUTMOTORS.CVA', amount: 100.00, type: 'expense' },
      { date: '2025-09-27', description: 'READ WITH ELLO ELLO.COM CA', amount: 14.99, type: 'expense' },
      { date: '2025-09-27', description: 'AMAZON MKTPL*LX9Z23Q53 Amzn.com/billWA', amount: 20.12, type: 'expense' },
      { date: '2025-09-27', description: 'AMAZON MKTPL*NJ9FB5S80 Amzn.com/billWA', amount: 33.91, type: 'expense' },
      { date: '2025-09-27', description: 'MIN*IDOKAID COURT FEE 800-297-5377 TX', amount: 3.15, type: 'expense' },
      { date: '2025-09-27', description: 'Amazon.com*TS0RD1OC3 Amzn.com/billWA', amount: 34.14, type: 'expense' },
      { date: '2025-09-27', description: 'MIN*IDOKAID COURT PYMT 208-436-7111 ID', amount: 90.00, type: 'expense' },
      { date: '2025-09-28', description: 'IC* INSTACART 888-246-7822 CA', amount: 6.48, type: 'expense' },
      { date: '2025-09-28', description: 'IC* INSTACART 888-246-7822 CA', amount: 140.07, type: 'expense' },
      { date: '2025-09-28', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 177.66, type: 'expense' },
      { date: '2025-09-29', description: 'AMAZON MKTPL*NV05B3N40 Amzn.com/billWA', amount: 14.05, type: 'expense' },
      { date: '2025-09-29', description: 'NORTHWEST PETS EAGLE EAGLE ID', amount: 18.00, type: 'expense' },
      { date: '2025-09-30', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 15.87, type: 'expense' },
      { date: '2025-09-30', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 19.79, type: 'expense' },
      { date: '2025-09-30', description: 'ABT.COM 888-228-5800 IL', amount: 62.54, type: 'expense' },
      { date: '2025-10-01', description: 'ALBERTSONS #0182 EAGLE ID', amount: 30.92, type: 'expense' },
      { date: '2025-10-01', description: 'THE HOME DEPOT #1809 EAGLE ID', amount: 69.41, type: 'income' },
      { date: '2025-10-02', description: 'Amazon.com*NV9LZ0580 Amzn.com/billWA', amount: 3.69, type: 'expense' },
      { date: '2025-10-02', description: 'SQ *MY DONUTS EAGLE EAGLE ID', amount: 20.64, type: 'expense' },
      { date: '2025-10-02', description: 'AMAZON MKTPL*NV3CW4FJ1 Amzn.com/billWA', amount: 23.31, type: 'expense' },
      { date: '2025-10-02', description: 'AMAZON MKTPL*NJ51T7RY1 Amzn.com/billWA', amount: 43.73, type: 'expense' },
      { date: '2025-10-02', description: 'STARBUCKS STORE 03236 EAGLE ID', amount: 6.94, type: 'expense' },
      { date: '2025-10-03', description: 'AMAZON MKTPL*NV8G61QW0 Amzn.com/billWA', amount: 161.12, type: 'expense' },
      { date: '2025-10-03', description: 'Amazon.com*NV5I12J0 Amzn.com/billWA', amount: 13.77, type: 'expense' },
      { date: '2025-10-03', description: 'AMAZON MKTPL*NV5AI23B1 Amzn.com/billWA', amount: 104.94, type: 'expense' },
      { date: '2025-10-03', description: 'AMAZON MKTPLACE PMTS Amzn.com/billWA', amount: 14.83, type: 'income' },
      { date: '2025-10-04', description: 'IC* INSTACART 888-246-7822 CA', amount: 4.97, type: 'expense' },
      { date: '2025-10-04', description: 'IC* INSTACART 888-246-7822 CA', amount: 212.25, type: 'expense' },
      { date: '2025-10-05', description: 'THE RUSTY DOG CALDWELL ID', amount: 2.06, type: 'expense' },
      { date: '2025-10-05', description: 'THE RUSTY DOG CALDWELL ID', amount: 13.39, type: 'expense' },
      { date: '2025-10-05', description: 'AMAZON MKTPL*NV3YN4402 Amzn.com/billWA', amount: 14.83, type: 'expense' },
      { date: '2025-10-06', description: 'AMAZON MKTPL*NV4RW78X1 Amzn.com/billWA', amount: 206.69, type: 'expense' },
      { date: '2025-10-06', description: 'AMAZON MKTPL*NV43S00R2 Amzn.com/billWA', amount: 18.97, type: 'expense' },
      { date: '2025-10-06', description: 'AMAZON MKTPL*NV69K21K2 Amzn.com/billWA', amount: 52.99, type: 'expense' },
      { date: '2025-10-07', description: 'BENCHMADE INC. B2C 503-655-6004 OR', amount: 10.60, type: 'expense' },
      { date: '2025-10-07', description: 'AMAZON MKTPL*NV93N85K2 Amzn.com/billWA', amount: 30.09, type: 'expense' },
      { date: '2025-10-07', description: 'AMAZON MKTPLACE PMTS Amzn.com/billWA', amount: 104.94, type: 'income' },
      { date: '2025-10-08', description: 'IC* INSTACART 888-246-7822 CA', amount: 149.92, type: 'expense' },
      { date: '2025-10-08', description: 'MIDSTAR FIREARMS LLC MIDDLETON ID', amount: 86.45, type: 'expense' },
      { date: '2025-10-08', description: 'AIR1 888-937-2471 CA', amount: 15.00, type: 'expense' },
      { date: '2025-10-09', description: 'STARBUCKS STORE 03236 EAGLE ID', amount: 9.64, type: 'expense' },
      { date: '2025-10-10', description: 'ALBERTSONS #0182 EAGLE ID', amount: 50.86, type: 'expense' },
      { date: '2025-10-13', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 156.17, type: 'expense' },
      { date: '2025-10-13', description: 'MCDONALD\'S F39880 STAR ID', amount: 11.95, type: 'expense' },
      { date: '2025-10-13', description: 'Amazon.com*NF4RO7HT2 Amzn.com/billWA', amount: 13.24, type: 'expense' },
      { date: '2025-10-13', description: 'IC* INSTACART 888-2467822 CA', amount: 222.95, type: 'expense' },
      { date: '2025-10-14', description: 'D&B SUPPLY CO STORE 8 BOISE ID', amount: 243.73, type: 'expense' },
      { date: '2025-10-14', description: 'Amazon.com*NM3745JH1 Amzn.com/billWA', amount: 8.47, type: 'expense' },
      { date: '2025-10-14', description: 'Amazon.com*NM4QK6PP1 Amzn.com/billWA', amount: 30.70, type: 'expense' },
      { date: '2025-10-14', description: 'AMAZON MKTPL*NM07B7850 Amzn.com/billWA', amount: 38.10, type: 'expense' },
      { date: '2025-10-14', description: 'AMAZON MKTPL*NM5KC9A61 Amzn.com/billWA', amount: 57.21, type: 'expense' },
      { date: '2025-10-14', description: 'ONLINE PAYMENT, THANK YOU', amount: 6340.34, type: 'income' },
      { date: '2025-10-15', description: 'ZIDAHO.COM 208-724-5860 ID', amount: 5.00, type: 'expense' },
      { date: '2025-10-15', description: 'CHIPOTLE 2783 BOISE ID', amount: 32.49, type: 'expense' },
      { date: '2025-10-16', description: 'ONLINE PAYMENT, THANK YOU', amount: 853.74, type: 'income' }
    ]
  },
  'citi_nov.pdf': {
    month: 'nov',
    year: 2025,
    period: '10/17/25-11/18/25',
    transactions: [
      { date: '2025-10-17', description: 'SSA BOISE ZOO BOISE ID', amount: 4.76, type: 'expense' },
      { date: '2025-10-17', description: 'Amazon.com*NM14S5KH1 Amzn.com/billWA', amount: 12.69, type: 'expense' },
      { date: '2025-10-17', description: 'Amazon.com*NU3C62430 Amzn.com/billWA', amount: 11.31, type: 'expense' },
      { date: '2025-10-17', description: 'SQ *SALT & LIGHT COFFEE LEAGLE ID', amount: 18.29, type: 'expense' },
      { date: '2025-10-17', description: 'NORTHWEST PETS EAGLE EAGLE ID', amount: 18.00, type: 'expense' },
      { date: '2025-10-18', description: 'Prime Video Channels amzn.com/billWA', amount: 5.99, type: 'expense' },
      { date: '2025-10-18', description: 'SQ *MIDWAY DONUTS Boise ID', amount: 8.00, type: 'expense' },
      { date: '2025-10-18', description: 'SQ *LOWE FAMILY FARMSTEADKuna ID', amount: 14.00, type: 'expense' },
      { date: '2025-10-18', description: 'SQ *LOWE FAMILY FARMSTEADKuna ID', amount: 25.18, type: 'expense' },
      { date: '2025-10-18', description: 'SQ *LOWE FAMILY FARMSTEADKuna ID', amount: 110.96, type: 'expense' },
      { date: '2025-10-19', description: 'IC* INSTACART INSTACART.COMCA', amount: 205.72, type: 'expense' },
      { date: '2025-10-19', description: 'AMAZON MKTPL*NU0VZ5110 Amzn.com/billWA', amount: 13.75, type: 'expense' },
      { date: '2025-10-20', description: 'USPS CHANGE OF ADDRESS 800-238-3150 TN', amount: 1.25, type: 'expense' },
      { date: '2025-10-20', description: 'SOUTHWES 5262397896400800-435-9792 TX', amount: 11.20, type: 'expense' },
      { date: '2025-10-20', description: 'SOUTHWES 5262397896399800-435-9792 TX', amount: 11.20, type: 'expense' },
      { date: '2025-10-20', description: 'SOUTHWES 5262397896398800-435-9792 TX', amount: 11.20, type: 'expense' },
      { date: '2025-10-20', description: 'SOUTHWES 5262397896397800-435-9792 TX', amount: 11.20, type: 'expense' },
      { date: '2025-10-21', description: '1000BULBS.COM 800-624-4488 TX', amount: 654.92, type: 'expense' },
      { date: '2025-10-22', description: 'AMAZON MKTPL*NU3D69KE0 Amzn.com/billWA', amount: 16.95, type: 'expense' },
      { date: '2025-10-23', description: 'PLAY IT AGAIN SPORTS B PLAYITAGAINSPID', amount: 745.00, type: 'expense' },
      { date: '2025-10-23', description: 'AMAZON MKTPL*NU6OO0IF0 Amzn.com/billWA', amount: 37.09, type: 'expense' },
      { date: '2025-10-23', description: 'NORTHWEST PETS EAGLE EAGLE ID', amount: 18.00, type: 'expense' },
      { date: '2025-10-23', description: 'THE HOME DEPOT #1809 EAGLE ID', amount: 2.63, type: 'expense' },
      { date: '2025-10-24', description: 'MCDONALD\'S F19731 EAGLE ID', amount: 1.48, type: 'expense' },
      { date: '2025-10-24', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 34.08, type: 'expense' },
      { date: '2025-10-25', description: 'CTLP*SCHEELS INC FARGO ND', amount: 1.00, type: 'expense' },
      { date: '2025-10-25', description: 'CTLP*SCHEELS INC FARGO ND', amount: 1.00, type: 'expense' },
      { date: '2025-10-25', description: 'CTLP*SCHEELS INC FARGO ND', amount: 1.00, type: 'expense' },
      { date: '2025-10-25', description: 'CTLP*SCHEELS INC FARGO ND', amount: 1.00, type: 'expense' },
      { date: '2025-10-25', description: 'CHICK-FIL-A #05545 MERIDIAN ID', amount: 13.67, type: 'expense' },
      { date: '2025-10-25', description: 'AMAZON PRIME*NU9S45Q82 amzn.com/billWA', amount: 2.99, type: 'expense' },
      { date: '2025-10-25', description: 'AMAZON MKTPL*N41L72EC0 Amzn.com/billWA', amount: 8.96, type: 'expense' },
      { date: '2025-10-25', description: 'AMAZON MKTPL*N44P79EG0 Amzn.com/billWA', amount: 20.12, type: 'expense' },
      { date: '2025-10-25', description: 'Scheels Meridian Meridian ID', amount: 395.34, type: 'expense' },
      { date: '2025-10-26', description: 'IC* INSTACART INSTACART.COMCA', amount: 172.30, type: 'expense' },
      { date: '2025-10-26', description: 'IC* COSTCO BY INSTACAR 888-2467822 CA', amount: 220.86, type: 'expense' },
      { date: '2025-10-27', description: 'READ WITH ELLO ELLO.COM CA', amount: 14.99, type: 'expense' },
      { date: '2025-10-27', description: 'AMAZON MKTPL*N426D92Z0 Amzn.com/billWA', amount: 6.99, type: 'expense' },
      { date: '2025-10-27', description: 'Amazon.com*N41VA5601 Amzn.com/billWA', amount: 14.83, type: 'expense' },
      { date: '2025-10-27', description: 'Amazon.com*N43UM7F82 Amzn.com/billWA', amount: 15.87, type: 'expense' },
      { date: '2025-10-27', description: 'AMAZON MKTPL*N40HA5DQ0 Amzn.com/billWA', amount: 20.13, type: 'expense' },
      { date: '2025-10-27', description: 'AMAZON MKTPL*N43PN8Q41 Amzn.com/billWA', amount: 29.56, type: 'expense' },
      { date: '2025-10-27', description: 'ONLINE PAYMENT, THANK YOU', amount: 1809.72, type: 'income' },
      { date: '2025-10-29', description: 'Kindle Svcs*N42AA10Y2 888-802-3080 WA', amount: 0.99, type: 'expense' },
      { date: '2025-10-30', description: 'IC* INSTACART 888-246-7822 CA', amount: 10.89, type: 'expense' },
      { date: '2025-10-30', description: 'IC* INSTACART 888-246-7822 CA', amount: 116.32, type: 'expense' },
      { date: '2025-10-30', description: 'EVOLUTION INTEGRATIVE MEDEAGLE ID', amount: 171.58, type: 'expense' },
      { date: '2025-10-31', description: 'ORIGIN FINANCIAL USEORIGIN.COMMA', amount: 1.00, type: 'expense' },
      { date: '2025-10-31', description: 'THE HOME DEPOT #1809 EAGLE ID', amount: 69.41, type: 'expense' },
      { date: '2025-11-01', description: 'THE HOME DEPOT #1809 EAGLE ID', amount: 69.41, type: 'income' },
      { date: '2025-11-02', description: 'FH* IDAHO SLEIGH RIDES IDAHOSLEIGHRIID', amount: 448.00, type: 'expense' },
      { date: '2025-11-02', description: 'STARBUCKS STORE 03236 EAGLE ID', amount: 6.94, type: 'expense' },
      { date: '2025-11-02', description: 'IC* INSTACART 888-2467822 CA', amount: 204.84, type: 'expense' },
      { date: '2025-11-03', description: 'AMAZON MKTPLACE PMTS Amzn.com/billWA', amount: 14.83, type: 'income' },
      { date: '2025-11-03', description: 'ONLINE PAYMENT, THANK YOU', amount: 1574.85, type: 'income' },
      { date: '2025-11-04', description: 'MCDONALD\'S F39880 STAR ID', amount: 1.58, type: 'expense' },
      { date: '2025-11-04', description: 'AMAZON MKTPL*NK4IP1951 Amzn.com/billWA', amount: 40.82, type: 'expense' },
      { date: '2025-11-04', description: 'PLAYITAGAINSP #11218 BOISE ID', amount: 105.93, type: 'expense' },
      { date: '2025-11-05', description: 'AMAZON MKTPL*BT7KE8FS0 Amzn.com/billWA', amount: 24.91, type: 'expense' },
      { date: '2025-11-05', description: 'Amazon.com*BT8LQ7NB0 Amzn.com/billWA', amount: 26.73, type: 'expense' },
      { date: '2025-11-05', description: 'AMAZON MKTPL*BT9UF9OS1 Amzn.com/billWA', amount: 48.75, type: 'expense' },
      { date: '2025-11-05', description: 'AMAZON MKTPL*BT4EV0FN1 Amzn.com/billWA', amount: 56.37, type: 'expense' },
      { date: '2025-11-05', description: 'AMAZON MKTPL*NK93N2QO2 Amzn.com/billWA', amount: 146.20, type: 'expense' },
      { date: '2025-11-07', description: 'AMAZON PRIME*430EP7DS3 Amzn.com/billWA', amount: 149.77, type: 'expense' },
      { date: '2025-11-08', description: 'AIR1 888-937-2471 CA', amount: 15.00, type: 'expense' },
      { date: '2025-11-10', description: 'IC* INSTACART 888-246-7822 CA', amount: 114.62, type: 'expense' },
      { date: '2025-11-10', description: 'ONLINE PAYMENT, THANK YOU', amount: 1097.24, type: 'income' },
      { date: '2025-11-11', description: 'SP OLLIE OLLIESMILE.COMI', amount: 27.78, type: 'expense' },
      { date: '2025-11-11', description: 'AIRBNB * HMFRYZDRPX AIRBNB.COM CA', amount: 7371.99, type: 'expense' },
      { date: '2025-11-12', description: 'PY *WEST ADA SCHOOL DISTR916-467-4700 ID', amount: 207.90, type: 'expense' },
      { date: '2025-11-13', description: 'NORTHWEST PETS EAGLE EAGLE ID', amount: 18.00, type: 'expense' },
      { date: '2025-11-15', description: 'IC* INSTACART INSTACART.COMCA', amount: 7.60, type: 'expense' },
      { date: '2025-11-15', description: 'IC* INSTACART INSTACART.COMCA', amount: 95.45, type: 'expense' },
      { date: '2025-11-15', description: 'IC* INSTACART 888-246-7822 CA', amount: 40.22, type: 'expense' },
      { date: '2025-11-17', description: 'IC* INSTACART SAN FRANCISCOCA', amount: 9.69, type: 'income' },
      { date: '2025-11-17', description: 'TARGET 00032987 SANTA BARBARACA', amount: 38.22, type: 'income' },
      { date: '2025-11-17', description: 'ONLINE PAYMENT, THANK YOU', amount: 7919.94, type: 'income' },
      { date: '2025-11-17', description: 'SEOULMATE KITCHEN SANTA BARBARACA', amount: 19.34, type: 'expense' },
      { date: '2025-11-17', description: 'TARGET 00032987 SANTA BARBARACA', amount: 88.02, type: 'expense' },
      { date: '2025-11-17', description: 'SQ *RORI\'S ARTISANAL CREASanta BarbaraCA', amount: 10.50, type: 'expense' },
      { date: '2025-11-17', description: 'SQ *SANTA BARBARA AIRPORTSanta BarbaraCA', amount: 30.26, type: 'expense' }
    ]
  },
  'citi_dec.pdf': {
    month: 'dec',
    year: 2025,
    period: '11/19/25-12/16/25',
    transactions: [
      { date: '2025-11-19', description: 'SHELL OIL13142952012 GOLETA CA', amount: 24.34, type: 'expense' },
      { date: '2025-11-19', description: 'BURGERS AND BREWS SMF SACRAMENTO CA', amount: 20.46, type: 'expense' },
      { date: '2025-11-19', description: 'STARBUCKS STORE 48050 GOLETA CA', amount: 18.35, type: 'expense' },
      { date: '2025-11-19', description: 'Prime Video Channels amzn.com/billWA', amount: 5.99, type: 'expense' },
      { date: '2025-11-19', description: 'IC* INSTACART INSTACART.COMCA', amount: 30.75, type: 'expense' },
      { date: '2025-11-19', description: 'AMAZON MKTPL*B00B96J30 Amzn.com/billWA', amount: 8.47, type: 'expense' },
      { date: '2025-11-20', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 312.10, type: 'expense' },
      { date: '2025-11-20', description: 'SP BANANA INK BANANA-INK.COID', amount: 32.98, type: 'expense' },
      { date: '2025-11-20', description: 'STARBUCKS STORE 03236 EAGLE ID', amount: 11.13, type: 'expense' },
      { date: '2025-11-21', description: 'AMAZON MKTPL*B04JX09B1 Amzn.com/billWA', amount: 20.12, type: 'expense' },
      { date: '2025-11-21', description: 'Amazon.com*B040X69D1 Amzn.com/billWA', amount: 24.07, type: 'expense' },
      { date: '2025-11-21', description: 'AMAZON MKTPL*B01DL9QA0 Amzn.com/billWA', amount: 57.23, type: 'expense' },
      { date: '2025-11-21', description: 'AMAZON MKTPL*B05DL2QR0 Amzn.com/billWA', amount: 179.25, type: 'expense' },
      { date: '2025-11-22', description: 'IC* INSTACART INSTACART.COMCA', amount: 176.33, type: 'expense' },
      { date: '2025-11-22', description: 'IC* INSTACART SAN FRANCISCOCA', amount: 6.83, type: 'income' },
      { date: '2025-11-23', description: 'IC* INSTACART SAN FRANCISCOCA', amount: 11.65, type: 'income' },
      { date: '2025-11-23', description: 'TST*SEA SALT CREAMERY - Star ID', amount: 16.96, type: 'expense' },
      { date: '2025-11-23', description: 'TST*SEA SALT CREAMERY - Star ID', amount: 18.49, type: 'expense' },
      { date: '2025-11-24', description: 'SP BEIS TRAVEL BEISTRAVEL.COCA', amount: 100.81, type: 'expense' },
      { date: '2025-11-24', description: 'SP BAKINGSTEEL.COM BAKINGSTEEL.CMI', amount: 169.00, type: 'expense' },
      { date: '2025-11-24', description: 'AMAZON MKTPL*B204R83I2 Amzn.com/billWA', amount: 11.65, type: 'expense' },
      { date: '2025-11-24', description: 'AMAZON MKTPL*B29U36TC1 Amzn.com/billWA', amount: 12.71, type: 'expense' },
      { date: '2025-11-24', description: 'AMAZON MKTPL*B26RN4C90 Amzn.com/billWA', amount: 13.56, type: 'expense' },
      { date: '2025-11-24', description: 'Amazon.com*B21KM7JE1 Amzn.com/billWA', amount: 13.73, type: 'expense' },
      { date: '2025-11-24', description: 'ONLINE PAYMENT, THANK YOU', amount: 1080.94, type: 'income' },
      { date: '2025-11-25', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 14.42, type: 'expense' },
      { date: '2025-11-25', description: 'IC* INSTACART 888-246-7822 CA', amount: 74.19, type: 'expense' },
      { date: '2025-11-25', description: 'IC* COSTCO BY IN CAR 888-246-7822 CA', amount: 177.59, type: 'expense' },
      { date: '2025-11-25', description: 'CLEANCO CARPET AIR DU info@cleanco-WA', amount: 469.80, type: 'expense' },
      { date: '2025-11-25', description: 'AMAZON PRIME*B23DL5070 amzn.com/billWA', amount: 2.99, type: 'expense' },
      { date: '2025-11-25', description: 'AMAZON MKTPL*B251D9HY2 Amzn.com/billWA', amount: 15.89, type: 'expense' },
      { date: '2025-11-26', description: 'AMAZON MKTPL*B21L16530 Amzn.com/billWA', amount: 115.24, type: 'expense' },
      { date: '2025-11-27', description: 'READ WITH ELLO ELLO.COM CA', amount: 14.99, type: 'expense' },
      { date: '2025-11-27', description: 'ADA COUNTY 888-8916064 ID', amount: 216.94, type: 'expense' },
      { date: '2025-11-27', description: 'AMAZON MKTPL*B25792840 Amzn.com/billWA', amount: 42.36, type: 'expense' },
      { date: '2025-11-27', description: 'IC* INSTACART 888-2467822 CA', amount: 0.01, type: 'expense' },
      { date: '2025-11-27', description: 'IC* INSTACART 888-2467822 CA', amount: 40.80, type: 'expense' },
      { date: '2025-11-28', description: 'SP FENO FENO.CO CA', amount: 269.24, type: 'expense' },
      { date: '2025-11-28', description: 'SP 33THREADS TAVIACTIVE.COCA', amount: 164.15, type: 'expense' },
      { date: '2025-11-28', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 15.14, type: 'expense' },
      { date: '2025-11-28', description: 'FREDDY\'S 77-0006 EAGLE ID', amount: 17.04, type: 'expense' },
      { date: '2025-11-28', description: 'AMAZON MKTPL*BB0QV0JU2 Amzn.com/billWA', amount: 7.41, type: 'expense' },
      { date: '2025-11-28', description: 'SQ *VILLAGE AT MERIDIAN gosq.com ID', amount: 21.20, type: 'expense' },
      { date: '2025-11-29', description: 'AMAZON MKTPL*BB8VD5EF2 Amzn.com/billWA', amount: 6.35, type: 'expense' },
      { date: '2025-11-29', description: 'Amazon.com*BB5WW7TK2 Amzn.com/billWA', amount: 21.03, type: 'expense' },
      { date: '2025-11-29', description: 'AMAZON MKTPL*BB9RV3CT0 Amzn.com/billWA', amount: 31.79, type: 'expense' },
      { date: '2025-11-30', description: 'IN-N-OUT MERIDIAN MERIDIAN ID', amount: 33.00, type: 'expense' },
      { date: '2025-12-01', description: 'AIRBNB * HMFRYZDRPX AIRBNB.COM CA', amount: 1389.62, type: 'expense' },
      { date: '2025-12-01', description: 'USPS PO 1526500416 EAGLE ID', amount: 78.00, type: 'expense' },
      { date: '2025-12-01', description: 'ONLINE PAYMENT, THANK YOU', amount: 2289.16, type: 'income' },
      { date: '2025-12-02', description: 'RLI INSURANCE COMPANY 309-692-1000 IL', amount: 515.00, type: 'expense' },
      { date: '2025-12-02', description: 'GYRO SHACK - STATE ST BOISE ID', amount: 18.59, type: 'expense' },
      { date: '2025-12-02', description: 'Amazon.com*BB6IO3KN1 Amzn.com/billWA', amount: 19.67, type: 'expense' },
      { date: '2025-12-02', description: 'Safeco Corporation Boston MA', amount: 1614.00, type: 'expense' },
      { date: '2025-12-04', description: 'IC* COSTCO BY INSTACAR INSTACART.COMCA', amount: 247.38, type: 'expense' },
      { date: '2025-12-04', description: 'AMAZON MKTPL*BI24V9E81 Amzn.com/billWA', amount: 6.35, type: 'expense' },
      { date: '2025-12-04', description: 'AMAZON MKTPL*BI6Z20371 Amzn.com/billWA', amount: 45.22, type: 'expense' },
      { date: '2025-12-05', description: 'SP GIBOARDUS GIBBON-USA.COCA', amount: 180.19, type: 'expense' },
      { date: '2025-12-06', description: 'MCDONALD\'S F19731 EAGLE ID', amount: 15.12, type: 'expense' },
      { date: '2025-12-06', description: 'Amazon.com*BI8H121L0 Amzn.com/billWA', amount: 10.46, type: 'expense' },
      { date: '2025-12-06', description: 'Amazon.com*BI5JY01A0 Amzn.com/billWA', amount: 13.77, type: 'expense' },
      { date: '2025-12-06', description: 'AMAZON MKTPL*BI11X31D0 Amzn.com/billWA', amount: 14.83, type: 'expense' },
      { date: '2025-12-07', description: '59608 BSU CONCESSIONS BOISE ID', amount: 5.30, type: 'expense' },
      { date: '2025-12-07', description: 'SP INTUITION LLC 120-84810770 ID', amount: 241.68, type: 'expense' },
      { date: '2025-12-08', description: 'SP MELTAIL MELTAIL.COM NV', amount: 109.99, type: 'expense' },
      { date: '2025-12-08', description: 'MCDONALD\'S F19731 EAGLE ID', amount: 9.84, type: 'expense' },
      { date: '2025-12-08', description: 'SQ *SALT & LIGHT COFFEE LEAGLE ID', amount: 11.93, type: 'expense' },
      { date: '2025-12-08', description: 'AIR1 888-937-2471 CA', amount: 15.00, type: 'expense' },
      { date: '2025-12-08', description: 'ONLINE PAYMENT, THANK YOU', amount: 4250.94, type: 'income' },
      { date: '2025-12-09', description: 'REDLANS GENTLEMENS GRO 120-89953409 ID', amount: 279.60, type: 'expense' },
      { date: '2025-12-09', description: 'ZIDAHO.COM 208-724-5860 ID', amount: 5.00, type: 'expense' },
      { date: '2025-12-09', description: 'SQ *SALT & LIGHT COFFEE LEAGLE ID', amount: 26.65, type: 'expense' },
      { date: '2025-12-09', description: 'AMAZON MKTPL*BW5JH9OA0 Amzn.com/billWA', amount: 39.78, type: 'expense' },
      { date: '2025-12-10', description: 'IC* INSTACART 888-246-7822 CA', amount: 166.32, type: 'expense' },
      { date: '2025-12-10', description: 'AMAZON MKTPL*NH42S2CT3 Amzn.com/billWA', amount: 8.47, type: 'expense' },
      { date: '2025-12-10', description: 'Amazon.com*950SL6QA3 Amzn.com/billWA', amount: 9.99, type: 'expense' },
      { date: '2025-12-10', description: 'AMAZON MKTPL*3P9PK5WL3 Amzn.com/billWA', amount: 14.76, type: 'expense' },
      { date: '2025-12-11', description: 'SQ *SALT & LIGHT COFFEE LEAGLE ID', amount: 20.35, type: 'expense' },
      { date: '2025-12-13', description: 'SP LIONS DEN TOYS BOOK 120-87890389 ID', amount: 284.97, type: 'expense' },
      { date: '2025-12-13', description: 'TST*SPITFIRE TACOS AND T 208-992-5977 ID', amount: 13.78, type: 'expense' },
      { date: '2025-12-14', description: 'PRICELINE.COM USD PRICELINE.COMCT', amount: 651.36, type: 'expense' },
      { date: '2025-12-14', description: 'AMAZON MKTPL*RO3EL65S3 Amzn.com/billWA', amount: 11.52, type: 'expense' },
      { date: '2025-12-14', description: 'AMAZON MKTPL*YV4P17HQ3 Amzn.com/billWA', amount: 21.07, type: 'expense' },
      { date: '2025-12-15', description: 'SP LIONS DEN TOYS BOOK 120-87890389 ID', amount: 100.65, type: 'expense' },
      { date: '2025-12-15', description: 'IC* INSTACART INSTACART.COMCA', amount: 194.55, type: 'expense' },
      { date: '2025-12-15', description: 'SQ *SALT & LIGHT COFFEE LEAGLE ID', amount: 7.15, type: 'expense' },
      { date: '2025-12-15', description: 'AMAZON MKTPL*BM4BQ6YK3 Amzn.com/billWA', amount: 9.38, type: 'expense' },
      { date: '2025-12-15', description: 'Amazon.com*AW1JP09A3 Amzn.com/billWA', amount: 107.42, type: 'expense' },
      { date: '2025-12-15', description: 'ONLINE PAYMENT, THANK YOU', amount: 1203.21, type: 'income' },
      { date: '2025-12-16', description: 'AMAZON MKTPL*R77T67JR3 Amzn.com/billWA', amount: 45.56, type: 'expense' }
    ]
  }
};

async function getInstitutionId() {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('id')
    .eq('name', 'Citibank')
    .maybeSingle();

  if (error || !data) {
    console.error('Citibank institution not found in database');
    return null;
  }

  return data.id;
}

async function loadCitiTransactions() {
  console.log('\n' + '='.repeat(60));
  console.log('LOADING CITIBANK STATEMENTS FROM EXTRACTED DATA');
  console.log('='.repeat(60) + '\n');

  console.log('Deleting existing Citibank statements...');
  const { error: deleteError } = await supabase
    .from('statement_cache')
    .delete()
    .eq('institution_name', 'Citibank');

  if (deleteError) {
    console.error('Error deleting Citibank statements:', deleteError.message);
    return;
  }
  console.log('Cleared Citibank cache\n');

  const institutionId = await getInstitutionId();
  if (!institutionId) {
    console.error('Cannot proceed without institution ID');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const [fileName, statementData] of Object.entries(statements)) {
    try {
      console.log(`Loading ${fileName}...`);

      const totalDebits = statementData.transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const totalCredits = statementData.transactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const { error } = await supabase
        .from('statement_cache')
        .insert({
          institution_id: institutionId,
          institution_name: 'Citibank',
          account_type: 'credit',
          account_number_last4: '1733',
          statement_month: statementData.month,
          statement_year: statementData.year,
          transactions_data: statementData.transactions,
          transaction_count: statementData.transactions.length,
          total_debits: totalDebits.toFixed(2),
          total_credits: totalCredits.toFixed(2),
          file_name: fileName
        });

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✓ Loaded ${statementData.transactions.length} transactions (${statementData.period})`);
        results.push({
          file: fileName,
          transactions: statementData.transactions.length,
          debits: totalDebits,
          credits: totalCredits
        });
        successCount++;
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('LOADING SUMMARY');
  console.log('='.repeat(60));
  console.log(`Success: ${successCount}`);
  console.log(`Errors:  ${errorCount}`);
  console.log(`Total:   ${Object.keys(statements).length}`);
  console.log('='.repeat(60) + '\n');

  if (results.length > 0) {
    console.log('Citibank Statements Loaded:');
    results.forEach(result => {
      console.log(`  ${result.file}: ${result.transactions} transactions`);
      console.log(`    Debits: $${result.debits.toFixed(2)}, Credits: $${result.credits.toFixed(2)}`);
    });
    console.log('\n✓ Citibank statements loaded successfully!\n');
  }
}

loadCitiTransactions().catch(console.error);
