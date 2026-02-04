import { supabase } from './supabaseClient';

const AMEX_SIMULATION_DATA = {
  "amex_sep": {
    "statement_month": "sep",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "3008",
        "account_type": "credit_card",
        "account_name": "Delta SkyMiles® Gold Card",
        "beginning_balance": -2882.89,
        "ending_balance": -9134.10,
        "transactions": [
          { "date": "2025-09-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -2882.89 },
          { "date": "2025-09-05", "description": "PARKER PORTRAITS 180110650101329", "amount": 26.51, "type": "expense", "balance": -2909.40 },
          { "date": "2025-09-05", "description": "LIGHT AFRICA", "amount": 67.00, "type": "expense", "balance": -2976.40 },
          { "date": "2025-09-06", "description": "SP BALLERINA FARM", "amount": 120.00, "type": "expense", "balance": -3096.40 },
          { "date": "2025-09-06", "description": "SP PORTOLA PAINTS", "amount": 117.41, "type": "expense", "balance": -3213.81 },
          { "date": "2025-09-06", "description": "KARVE", "amount": 10.00, "type": "expense", "balance": -3223.81 },
          { "date": "2025-09-06", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 16.96, "type": "expense", "balance": -3240.77 },
          { "date": "2025-09-07", "description": "KARVE", "amount": 35.00, "type": "expense", "balance": -3275.77 },
          { "date": "2025-09-07", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 18.55, "type": "expense", "balance": -3294.32 },
          { "date": "2025-09-07", "description": "TST* LUMSDEN RESTAURANT - 00038652", "amount": 87.08, "type": "expense", "balance": -3381.40 },
          { "date": "2025-09-07", "description": "AplPay DOMINO'S 7327 000007327", "amount": 24.51, "type": "expense", "balance": -3405.91 },
          { "date": "2025-09-08", "description": "ONLINE PAYMENT - THANK YOU", "amount": 1519.05, "type": "income", "balance": -1886.86 },
          { "date": "2025-09-10", "description": "THRIVE MARKET GOODS", "amount": 59.95, "type": "expense", "balance": -1946.81 },
          { "date": "2025-09-10", "description": "KARVE", "amount": 57.24, "type": "expense", "balance": -2004.05 },
          { "date": "2025-09-10", "description": "CRATE & BARREL/CB2 914", "amount": 793.94, "type": "income", "balance": -1210.11 },
          { "date": "2025-09-10", "description": "Scholastic, Inc. 210952883", "amount": 29.66, "type": "expense", "balance": -1239.77 },
          { "date": "2025-09-11", "description": "AplPay MCDONALD'S F19731", "amount": 27.81, "type": "expense", "balance": -1267.58 },
          { "date": "2025-09-12", "description": "AplPay APPLE.COM/BILL", "amount": 18.98, "type": "expense", "balance": -1286.56 },
          { "date": "2025-09-12", "description": "AplPay PHOTOPRINT ONL DEPOSIT", "amount": 8.87, "type": "expense", "balance": -1295.43 },
          { "date": "2025-09-12", "description": "AplPay IN-N-OUT MERIDIAN", "amount": 26.29, "type": "expense", "balance": -1321.72 },
          { "date": "2025-09-13", "description": "AplPay THE SUNDRY BOUTIQUE", "amount": 188.68, "type": "expense", "balance": -1510.40 },
          { "date": "2025-09-13", "description": "AplPay KARVE", "amount": 229.00, "type": "expense", "balance": -1739.40 },
          { "date": "2025-09-13", "description": "AplPay KARVE", "amount": 10.00, "type": "expense", "balance": -1749.40 },
          { "date": "2025-09-13", "description": "AplPay KARVE", "amount": 5.00, "type": "expense", "balance": -1754.40 },
          { "date": "2025-09-14", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 32.64, "type": "expense", "balance": -1787.04 },
          { "date": "2025-09-14", "description": "CRAVE KITCHEN & BAR", "amount": 144.84, "type": "expense", "balance": -1931.88 },
          { "date": "2025-09-14", "description": "AplPay BT*TIKTOK SHOP", "amount": 25.48, "type": "expense", "balance": -1957.36 },
          { "date": "2025-09-14", "description": "AplPay CAPITAL CHRISTIAN", "amount": 500.00, "type": "expense", "balance": -2457.36 },
          { "date": "2025-09-15", "description": "AAD INSPECTION", "amount": 1800.00, "type": "expense", "balance": -4257.36 },
          { "date": "2025-09-15", "description": "ONLINE PAYMENT - THANK YOU", "amount": 2337.96, "type": "income", "balance": -1919.40 },
          { "date": "2025-09-17", "description": "SP BALLERINA FARM", "amount": 68.00, "type": "expense", "balance": -1987.40 },
          { "date": "2025-09-18", "description": "AplPay CKE*DRY CREEK MERCANTILE", "amount": 16.07, "type": "expense", "balance": -2003.47 },
          { "date": "2025-09-18", "description": "AplPay POLISH PERFECT", "amount": 118.80, "type": "expense", "balance": -2122.27 },
          { "date": "2025-09-19", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 11.39, "type": "expense", "balance": -2133.66 },
          { "date": "2025-09-19", "description": "AplPay THRIVE MARKET GOODS", "amount": 106.65, "type": "expense", "balance": -2240.31 },
          { "date": "2025-09-19", "description": "AplPay MCDONALD'S F19731", "amount": 14.81, "type": "expense", "balance": -2255.12 },
          { "date": "2025-09-19", "description": "SP NUUDS", "amount": 79.08, "type": "expense", "balance": -2334.20 },
          { "date": "2025-09-21", "description": "AplPay APPLE.COM/BILL", "amount": 29.98, "type": "expense", "balance": -2364.18 },
          { "date": "2025-09-21", "description": "WWW.BOLDBREATHWORK.COM", "amount": 35.00, "type": "expense", "balance": -2399.18 },
          { "date": "2025-09-21", "description": "AplPay OLIVE TREE 4242524251", "amount": 141.40, "type": "expense", "balance": -2540.58 },
          { "date": "2025-09-23", "description": "AplPay RYLEEANDCRU 8583755923", "amount": 428.24, "type": "expense", "balance": -2968.82 },
          { "date": "2025-09-24", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 5.83, "type": "expense", "balance": -2974.65 },
          { "date": "2025-09-24", "description": "AplPay TST* AUBERGINE KITCHEN - 300726892", "amount": 65.21, "type": "expense", "balance": -3039.86 },
          { "date": "2025-09-25", "description": "AplPay POTTERYBARN.COM", "amount": 1081.94, "type": "expense", "balance": -4121.80 },
          { "date": "2025-09-26", "description": "AplPay MY DONUTS EAGLE", "amount": 15.89, "type": "expense", "balance": -4137.69 },
          { "date": "2025-09-27", "description": "SP BOMBAS", "amount": 113.42, "type": "expense", "balance": -4251.11 },
          { "date": "2025-09-27", "description": "AplPay TST* CAFFIENA RANCH 00245179", "amount": 3.87, "type": "expense", "balance": -4254.98 },
          { "date": "2025-09-28", "description": "AplPay PHOTODAY ORDER", "amount": 41.29, "type": "expense", "balance": -4296.27 },
          { "date": "2025-09-29", "description": "SP NUUDS", "amount": 188.68, "type": "expense", "balance": -4484.95 },
          { "date": "2025-09-29", "description": "BOISE CO-OP VILLAGE", "amount": 342.63, "type": "expense", "balance": -4827.58 },
          { "date": "2025-09-30", "description": "AplPay APPLE.COM/BILL", "amount": 9.99, "type": "expense", "balance": -4837.57 }
        ]
      }
    ]
  },
  "amex_oct": {
    "statement_month": "oct",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "3008",
        "account_type": "credit_card",
        "account_name": "Delta SkyMiles® Gold Card",
        "beginning_balance": -9134.10,
        "ending_balance": -4112.10,
        "transactions": [
          { "date": "2025-10-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -9134.10 },
          { "date": "2025-10-01", "description": "AplPay SEPHORA.COM", "amount": 73.14, "type": "expense", "balance": -9207.24 },
          { "date": "2025-10-02", "description": "AplPay APPLE.COM/BILL", "amount": 19.99, "type": "expense", "balance": -9227.23 },
          { "date": "2025-10-02", "description": "CRATE & BARREL/CB2 914", "amount": 549.55, "type": "expense", "balance": -9776.78 },
          { "date": "2025-10-03", "description": "TST* SPITFIRE TACOS AND T 00156301", "amount": 80.14, "type": "expense", "balance": -9856.92 },
          { "date": "2025-10-03", "description": "AplPay TST* CAFFIENA RANCH 00245179", "amount": 6.10, "type": "expense", "balance": -9863.02 },
          { "date": "2025-10-04", "description": "TST* PERCY 00110422", "amount": 69.06, "type": "expense", "balance": -9932.08 },
          { "date": "2025-10-05", "description": "GEICO AUTO", "amount": 432.15, "type": "expense", "balance": -10364.23 },
          { "date": "2025-10-05", "description": "LIGHT AFRICA", "amount": 67.00, "type": "expense", "balance": -10431.23 },
          { "date": "2025-10-05", "description": "SP RYLEEANDCRU", "amount": 310.57, "type": "expense", "balance": -10741.80 },
          { "date": "2025-10-05", "description": "AplPay PUMPKIN PALOOZA", "amount": 37.00, "type": "expense", "balance": -10778.80 },
          { "date": "2025-10-06", "description": "SP BALLERINA FARM", "amount": 71.60, "type": "expense", "balance": -10850.40 },
          { "date": "2025-10-07", "description": "AplPay THRIVE MARKET GOODS", "amount": 98.81, "type": "expense", "balance": -10949.21 },
          { "date": "2025-10-10", "description": "ONLINE PAYMENT - THANK YOU", "amount": 9657.12, "type": "income", "balance": -1292.09 },
          { "date": "2025-10-14", "description": "ONLINE PAYMENT - THANK YOU", "amount": 5206.22, "type": "income", "balance": 3914.13 },
          { "date": "2025-10-06", "description": "AplPay ZARA USA INC.", "amount": 427.26, "type": "expense", "balance": -427.26 },
          { "date": "2025-10-08", "description": "AplPay AWX*UNIFITSTYLE 980000001559397", "amount": 58.59, "type": "expense", "balance": -485.85 },
          { "date": "2025-10-10", "description": "AplPay TST* AUBERGINE KITCHEN - 00249509", "amount": 70.86, "type": "expense", "balance": -556.71 },
          { "date": "2025-10-10", "description": "SP MADEINCOOKWARE", "amount": 846.94, "type": "expense", "balance": -1403.65 },
          { "date": "2025-10-11", "description": "POLISH PERFECT", "amount": 102.00, "type": "expense", "balance": -1505.65 },
          { "date": "2025-10-11", "description": "AplPay MY FATHERS PLACE", "amount": 51.36, "type": "expense", "balance": -1557.01 },
          { "date": "2025-10-12", "description": "AplPay APPLE.COM/BILL", "amount": 3.99, "type": "expense", "balance": -1560.00 },
          { "date": "2025-10-12", "description": "KARVE", "amount": 229.00, "type": "expense", "balance": -1789.00 },
          { "date": "2025-10-13", "description": "AplPay SP DWELL HOME CO.", "amount": 434.48, "type": "expense", "balance": -2223.48 },
          { "date": "2025-10-13", "description": "CRATE & BARREL", "amount": 549.55, "type": "expense", "balance": -2773.03 },
          { "date": "2025-10-16", "description": "AplPay ZARA USA INC.", "amount": 57.85, "type": "expense", "balance": -2830.88 },
          { "date": "2025-10-16", "description": "ONLINE PAYMENT - THANK YOU", "amount": 1077.03, "type": "income", "balance": -1753.85 },
          { "date": "2025-10-17", "description": "AplPay THE BLEND SALON", "amount": 43.19, "type": "expense", "balance": -1797.04 },
          { "date": "2025-10-17", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 6.63, "type": "expense", "balance": -1803.67 },
          { "date": "2025-10-17", "description": "AplPay VILLAGE AT MERIDIAN ID-AN 000011559", "amount": 371.00, "type": "expense", "balance": -2174.67 },
          { "date": "2025-10-17", "description": "AplPay SP EVEREVE", "amount": 393.26, "type": "expense", "balance": -2567.93 },
          { "date": "2025-10-18", "description": "AplPay LOWE FAMILY FARMSTEAD", "amount": 5.00, "type": "expense", "balance": -2572.93 },
          { "date": "2025-10-18", "description": "AplPay TST* CHIP COOKIES - MERID 300603803", "amount": 8.18, "type": "expense", "balance": -2581.11 },
          { "date": "2025-10-18", "description": "KARVE", "amount": 5.00, "type": "expense", "balance": -2586.11 },
          { "date": "2025-10-18", "description": "SP TRANSPARENT LABS", "amount": 61.99, "type": "expense", "balance": -2648.10 },
          { "date": "2025-10-20", "description": "ONLINE PAYMENT - THANK YOU", "amount": 952.10, "type": "income", "balance": -1696.00 },
          { "date": "2025-10-24", "description": "SP NUUDS", "amount": 207.76, "type": "expense", "balance": -1903.76 },
          { "date": "2025-10-24", "description": "AplPay APPLE.COM/BILL", "amount": 49.97, "type": "expense", "balance": -1953.73 },
          { "date": "2025-10-26", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 28.84, "type": "expense", "balance": -1982.57 },
          { "date": "2025-10-26", "description": "AplPay TST* COSTA VIDA - MERIDIA 300681073", "amount": 20.44, "type": "expense", "balance": -2003.01 },
          { "date": "2025-10-28", "description": "NORDSTROM #0434 000000434", "amount": 445.00, "type": "expense", "balance": -2448.01 },
          { "date": "2025-10-28", "description": "AplPay NORDSTROM #0434 000000434", "amount": 459.00, "type": "expense", "balance": -2907.01 },
          { "date": "2025-10-29", "description": "NORDSTROM DIRECT http://shop.nordstrom", "amount": 83.74, "type": "expense", "balance": -2990.75 },
          { "date": "2025-10-29", "description": "GARDEN OF LIFE LLC - EC", "amount": 32.22, "type": "expense", "balance": -3022.97 },
          { "date": "2025-10-30", "description": "AplPay APPLE.COM/BILL", "amount": 9.99, "type": "expense", "balance": -3032.96 },
          { "date": "2025-10-30", "description": "AplPay BEEHIVEMEAL 8015890591", "amount": 204.73, "type": "expense", "balance": -3237.69 },
          { "date": "2025-10-30", "description": "ONLINE PAYMENT - THANK YOU", "amount": 1211.01, "type": "income", "balance": -2026.68 },
          { "date": "2025-10-31", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 24.91, "type": "expense", "balance": -2051.59 }
        ]
      }
    ]
  },
  "amex_dec": {
    "statement_month": "dec",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "3008",
        "account_type": "credit_card",
        "account_name": "Delta SkyMiles® Gold Card",
        "beginning_balance": -2455.46,
        "ending_balance": -4474.64,
        "transactions": [
          { "date": "2025-12-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -2455.46 },
          { "date": "2025-12-01", "description": "ONLINE PAYMENT - THANK YOU", "amount": 3180.31, "type": "income", "balance": 724.85 },
          { "date": "2025-11-06", "description": "AplPay ALBERTSONS #0182 0182", "amount": 17.47, "type": "expense", "balance": 707.38 },
          { "date": "2025-11-06", "description": "ALBERTSONS #0182 0182", "amount": 281.37, "type": "expense", "balance": 426.01 },
          { "date": "2025-11-06", "description": "AplPay ALBERTSONS #0182 0182", "amount": 23.43, "type": "expense", "balance": 402.58 },
          { "date": "2025-11-07", "description": "SP VUORI CLOTHING", "amount": 228.96, "type": "expense", "balance": 173.62 },
          { "date": "2025-11-07", "description": "CRAVE KITCHEN & BAR", "amount": 85.02, "type": "expense", "balance": 88.60 },
          { "date": "2025-11-08", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 17.17, "type": "expense", "balance": 71.43 },
          { "date": "2025-11-08", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 12.45, "type": "expense", "balance": 58.98 },
          { "date": "2025-11-09", "description": "SP LIVING PROOF INC", "amount": 84.80, "type": "expense", "balance": -25.82 },
          { "date": "2025-11-09", "description": "TST* THE WYLDER 00010388", "amount": 81.84, "type": "expense", "balance": -107.66 },
          { "date": "2025-11-10", "description": "AplPay THE STIL", "amount": 17.28, "type": "expense", "balance": -124.94 },
          { "date": "2025-11-10", "description": "AplPay THE SUNDRY BOUTIQUE", "amount": 37.10, "type": "expense", "balance": -162.04 },
          { "date": "2025-11-10", "description": "EVOLUTION INTEGRATIVE", "amount": 26.00, "type": "expense", "balance": -188.04 },
          { "date": "2025-11-10", "description": "SP BEAM", "amount": 34.45, "type": "expense", "balance": -222.49 },
          { "date": "2025-11-11", "description": "AplPay APPLE.COM/BILL", "amount": 3.99, "type": "expense", "balance": -226.48 },
          { "date": "2025-11-11", "description": "TST* CACI 00029692", "amount": 66.78, "type": "expense", "balance": -293.26 },
          { "date": "2025-11-12", "description": "AplPay AMERICAN EAGLE OUTFITTERS", "amount": 92.14, "type": "expense", "balance": -385.40 },
          { "date": "2025-11-12", "description": "SALT & LIGHT COFFEE LOUNGE LLC", "amount": 7.63, "type": "expense", "balance": -393.03 },
          { "date": "2025-11-12", "description": "KARVE", "amount": 229.00, "type": "expense", "balance": -622.03 },
          { "date": "2025-11-12", "description": "TEXAS ROADHOUSE GC FUND", "amount": 12.72, "type": "expense", "balance": -634.75 },
          { "date": "2025-11-12", "description": "AplPay SB* HERITAGEHEARTHBAKE", "amount": 60.72, "type": "expense", "balance": -695.47 },
          { "date": "2025-11-12", "description": "POTTERY BARN KIDS", "amount": 86.11, "type": "expense", "balance": -781.58 },
          { "date": "2025-11-13", "description": "AplPay AMERICAN EAGLE OUTFITTERS", "amount": 169.55, "type": "expense", "balance": -951.13 },
          { "date": "2025-11-14", "description": "AplPay TARGET 032987 09100032987", "amount": 82.81, "type": "expense", "balance": -1033.94 },
          { "date": "2025-11-15", "description": "AplPay RORI'S ARTISANAL CREAMERY", "amount": 34.00, "type": "expense", "balance": -1067.94 },
          { "date": "2025-11-15", "description": "AplPay MOTHER DOUGH BAGELS", "amount": 11.47, "type": "expense", "balance": -1079.41 },
          { "date": "2025-11-15", "description": "SPO*BETTINA 000004256", "amount": 79.64, "type": "expense", "balance": -1159.05 },
          { "date": "2025-11-15", "description": "SP BALLERINA FARM", "amount": 71.60, "type": "expense", "balance": -1230.65 },
          { "date": "2025-11-15", "description": "AplPay TARGET 032987 09100032987", "amount": 54.28, "type": "expense", "balance": -1284.93 },
          { "date": "2025-11-16", "description": "AplPay DUNE COFFEE", "amount": 13.00, "type": "expense", "balance": -1297.93 },
          { "date": "2025-11-16", "description": "AplPay RORI'S ARTISANAL CREAMERY PUBLIC MA", "amount": 9.50, "type": "expense", "balance": -1307.43 },
          { "date": "2025-11-17", "description": "AplPay BACKYARD BOWLS - LA CUMBRE PLAZA", "amount": 17.00, "type": "expense", "balance": -1324.43 },
          { "date": "2025-11-17", "description": "AplPay BACKYARD BOWLS - LA CUMBRE PLAZA", "amount": 12.00, "type": "expense", "balance": -1336.43 },
          { "date": "2025-11-17", "description": "KARVE", "amount": 5.00, "type": "expense", "balance": -1341.43 },
          { "date": "2025-11-17", "description": "FIRST CLASS CONCESSI", "amount": 24.65, "type": "expense", "balance": -1366.08 },
          { "date": "2025-11-17", "description": "TARGET 032987 09100032987", "amount": 40.41, "type": "income", "balance": -1325.67 },
          { "date": "2025-11-18", "description": "ETSY, INC.", "amount": 188.30, "type": "expense", "balance": -1513.97 },
          { "date": "2025-11-18", "description": "AplPay FAMOUS FAMIGLIA SAC", "amount": 30.84, "type": "expense", "balance": -1544.81 },
          { "date": "2025-11-18", "description": "Mauna Lani, Auberge Resorts", "amount": 1460.87, "type": "expense", "balance": -3005.68 },
          { "date": "2025-11-18", "description": "AplPay SPO*CA'DARIOPIZZERIAVELOC 000006281", "amount": 4.37, "type": "expense", "balance": -3010.05 },
          { "date": "2025-11-18", "description": "AplPay SPO*CA'DARIOPIZZERIAVELOC 000006281", "amount": 15.30, "type": "expense", "balance": -3025.35 },
          { "date": "2025-11-18", "description": "SP RUGSUSA.COM", "amount": 58.29, "type": "expense", "balance": -3083.64 },
          { "date": "2025-11-19", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 19.35, "type": "expense", "balance": -3102.99 },
          { "date": "2025-11-19", "description": "SP RYLEEANDCRU", "amount": 86.16, "type": "expense", "balance": -3189.15 },
          { "date": "2025-11-19", "description": "AplPay ETSY, INC.", "amount": 4.26, "type": "expense", "balance": -3193.41 },
          { "date": "2025-11-20", "description": "BT*TRULY FREE INC", "amount": 45.66, "type": "expense", "balance": -3239.07 },
          { "date": "2025-11-20", "description": "FORM & FUNCTION COFFEE - EAGLE", "amount": 7.63, "type": "expense", "balance": -3246.70 },
          { "date": "2025-11-20", "description": "AplPay RAISING CANE'S 1218", "amount": 29.21, "type": "expense", "balance": -3275.91 },
          { "date": "2025-11-20", "description": "AplPay ALBERTSONS #0182 0182", "amount": 63.03, "type": "expense", "balance": -3338.94 },
          { "date": "2025-11-21", "description": "AplPay THE SUNDRY BOUTIQUE", "amount": 40.28, "type": "expense", "balance": -3379.22 },
          { "date": "2025-11-23", "description": "SP CLUBSDOCK", "amount": 129.00, "type": "expense", "balance": -3508.22 },
          { "date": "2025-11-23", "description": "AplPay SP KUIU LLC", "amount": 45.05, "type": "expense", "balance": -3553.27 },
          { "date": "2025-11-23", "description": "AplPay CARHARTT", "amount": 63.59, "type": "expense", "balance": -3616.86 },
          { "date": "2025-11-24", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 10.60, "type": "expense", "balance": -3627.46 },
          { "date": "2025-11-24", "description": "AplPay APPLE.COM/BILL", "amount": 49.97, "type": "expense", "balance": -3677.43 },
          { "date": "2025-11-24", "description": "AplPay BOSE CORPORATION", "amount": 210.94, "type": "expense", "balance": -3888.37 },
          { "date": "2025-11-25", "description": "AplPay BBQGUYS*18783890", "amount": 942.34, "type": "expense", "balance": -4830.71 },
          { "date": "2025-11-25", "description": "SP BEEHIVEMEALS", "amount": 228.05, "type": "expense", "balance": -5058.76 },
          { "date": "2025-11-25", "description": "CRAVE KITCHEN & BAR", "amount": 88.90, "type": "expense", "balance": -5147.66 },
          { "date": "2025-11-25", "description": "AplPay LLBEAN-DIRECT 084870000422109", "amount": 94.34, "type": "expense", "balance": -5242.00 },
          { "date": "2025-11-25", "description": "APPLE.COM/BILL", "amount": 0.93, "type": "income", "balance": -5241.07 },
          { "date": "2025-11-26", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 20.14, "type": "expense", "balance": -5261.21 },
          { "date": "2025-11-27", "description": "AplPay SP MAILEG TOYS", "amount": 1223.77, "type": "expense", "balance": -6484.98 },
          { "date": "2025-11-28", "description": "SP NUUDS", "amount": 148.51, "type": "expense", "balance": -6633.49 },
          { "date": "2025-11-28", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 6.63, "type": "expense", "balance": -6640.12 },
          { "date": "2025-11-28", "description": "SP DIVI OFFICIAL LLC", "amount": 100.91, "type": "expense", "balance": -6741.03 },
          { "date": "2025-11-28", "description": "AplPay SP DWELL HOME CO.", "amount": 255.32, "type": "expense", "balance": -6996.35 },
          { "date": "2025-11-29", "description": "SP MCGEE CO.", "amount": 141.82, "type": "expense", "balance": -7138.17 },
          { "date": "2025-11-29", "description": "SP MCGEE CO.", "amount": 852.25, "type": "expense", "balance": -7990.42 },
          { "date": "2025-11-29", "description": "AplPay SP ROCK AND RUDDLE LTD", "amount": 48.20, "type": "expense", "balance": -8038.62 },
          { "date": "2025-11-29", "description": "SP BOLL BRANCH", "amount": 742.28, "type": "expense", "balance": -8780.90 },
          { "date": "2025-11-30", "description": "AplPay ANTHROPOLOGIE 00507", "amount": 25.23, "type": "expense", "balance": -8806.13 },
          { "date": "2025-11-30", "description": "AplPay VILLAGE AT MERIDIAN", "amount": 31.79, "type": "expense", "balance": -8837.92 },
          { "date": "2025-11-30", "description": "AplPay APPLE.COM/BILL", "amount": 9.99, "type": "expense", "balance": -8847.91 },
          { "date": "2025-11-30", "description": "AplPay BOISE CO-OP VILLAGE", "amount": 188.20, "type": "expense", "balance": -9036.11 },
          { "date": "2025-11-30", "description": "SP SIERRA DREAMS", "amount": 365.50, "type": "expense", "balance": -9401.61 },
          { "date": "2025-12-01", "description": "SP NUUDS", "amount": 46.11, "type": "expense", "balance": -9447.72 },
          { "date": "2025-12-01", "description": "ONLINE PAYMENT - THANK YOU", "amount": 9739.84, "type": "income", "balance": 292.12 },
          { "date": "2025-12-03", "description": "AplPay TARGET", "amount": 150.98, "type": "expense", "balance": 141.14 },
          { "date": "2025-12-04", "description": "AplPay ETSY, INC.", "amount": 100.34, "type": "expense", "balance": 40.80 },
          { "date": "2025-12-05", "description": "AplPay SP TATORJO", "amount": 34.97, "type": "expense", "balance": 5.83 },
          { "date": "2025-12-05", "description": "MEGEN FLANARY", "amount": 21.20, "type": "expense", "balance": -15.37 },
          { "date": "2025-12-05", "description": "AplPay TONA TRANSFORMATIONS", "amount": 20.14, "type": "expense", "balance": -35.51 },
          { "date": "2025-12-05", "description": "AplPay WHIMSIES", "amount": 380.54, "type": "expense", "balance": -416.05 },
          { "date": "2025-12-05", "description": "AplPay THE BOOT LADY BOOTIQUE", "amount": 19.31, "type": "expense", "balance": -435.36 },
          { "date": "2025-12-05", "description": "AplPay APPLE.COM/BILL", "amount": 7.99, "type": "expense", "balance": -443.35 },
          { "date": "2025-12-05", "description": "SP SPARKIMEL", "amount": 83.99, "type": "expense", "balance": -527.34 },
          { "date": "2025-12-05", "description": "GEICO AUTO", "amount": 437.18, "type": "expense", "balance": -964.52 },
          { "date": "2025-12-05", "description": "AplPay IDAHO PIZZA COMPANY EAGL", "amount": 45.36, "type": "expense", "balance": -1009.88 },
          { "date": "2025-12-05", "description": "SP BALLERINA FARM", "amount": 71.60, "type": "expense", "balance": -1081.48 },
          { "date": "2025-12-05", "description": "LIGHT AFRICA", "amount": 67.00, "type": "expense", "balance": -1148.48 },
          { "date": "2025-12-06", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 24.65, "type": "expense", "balance": -1173.13 },
          { "date": "2025-12-06", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 1.33, "type": "expense", "balance": -1174.46 },
          { "date": "2025-12-07", "description": "AplPay EAGLENAZ.COM", "amount": 100.00, "type": "expense", "balance": -1274.46 },
          { "date": "2025-12-07", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 19.87, "type": "expense", "balance": -1294.33 }
        ]
      }
    ]
  }
};

const CITI_SIMULATION_DATA = {
  "citi_nov": {
    "statement_month": "nov",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1733",
        "account_type": "credit_card",
        "account_name": "Citi Costco Credit Card",
        "beginning_balance": 37.49,
        "ending_balance": 627.50,
        "transactions": [
          { "date": "2025-10-17", "description": "SSA BOISE ZOO BOISE ID", "amount": 4.76, "type": "expense", "balance": 42.25 },
          { "date": "2025-10-17", "description": "Amazon.com*NM14S5KH1 Amzn.com/billWA", "amount": 12.69, "type": "expense", "balance": 54.94 },
          { "date": "2025-10-17", "description": "Amazon.com*NU3C62430 Amzn.com/billWA", "amount": 11.31, "type": "expense", "balance": 66.25 },
          { "date": "2025-10-17", "description": "SQ *SALT & LIGHT COFFEE LEAGLE ID", "amount": 18.29, "type": "expense", "balance": 84.54 },
          { "date": "2025-10-17", "description": "NORTHWEST PETS EAGLE EAGLE ID", "amount": 18.00, "type": "expense", "balance": 102.54 },
          { "date": "2025-10-18", "description": "Prime Video Channels amzn.com/billWA", "amount": 5.99, "type": "expense", "balance": 108.53 },
          { "date": "2025-10-18", "description": "SQ *MIDWAY DONUTS Boise ID", "amount": 8.00, "type": "expense", "balance": 116.53 },
          { "date": "2025-10-18", "description": "SQ *LOWE FAMILY FARMSTEADKuna ID", "amount": 14.00, "type": "expense", "balance": 130.53 },
          { "date": "2025-10-18", "description": "SQ *LOWE FAMILY FARMSTEADKuna ID", "amount": 25.18, "type": "expense", "balance": 155.71 },
          { "date": "2025-10-18", "description": "SQ *LOWE FAMILY FARMSTEADKuna ID", "amount": 110.96, "type": "expense", "balance": 266.67 },
          { "date": "2025-10-19", "description": "IC* INSTACART INSTACART.COMCA", "amount": 205.72, "type": "expense", "balance": 472.39 },
          { "date": "2025-10-19", "description": "AMAZON MKTPL*NU0VZ5110 Amzn.com/billWA", "amount": 13.75, "type": "expense", "balance": 486.14 },
          { "date": "2025-10-20", "description": "USPS CHANGE OF ADDRESS 800-238-3150 TN", "amount": 1.25, "type": "expense", "balance": 487.39 },
          { "date": "2025-10-20", "description": "SOUTHWEST AIRLINES", "amount": 11.20, "type": "expense", "balance": 498.59 },
          { "date": "2025-10-20", "description": "SOUTHWEST AIRLINES", "amount": 11.20, "type": "expense", "balance": 509.79 },
          { "date": "2025-10-20", "description": "SOUTHWEST AIRLINES", "amount": 11.20, "type": "expense", "balance": 520.99 },
          { "date": "2025-10-20", "description": "SOUTHWEST AIRLINES", "amount": 11.20, "type": "expense", "balance": 532.19 },
          { "date": "2025-10-21", "description": "1000BULBS.COM 800-624-4488 TX", "amount": 654.92, "type": "expense", "balance": 1187.11 },
          { "date": "2025-10-21", "description": "SQ *STELLA'S ICE CREAM - Eagle ID", "amount": 15.11, "type": "expense", "balance": 1202.22 },
          { "date": "2025-10-22", "description": "AMAZON MKTPL*NU3D69KE0 Amzn.com/billWA", "amount": 16.95, "type": "expense", "balance": 1219.17 },
          { "date": "2025-10-23", "description": "PLAY IT AGAIN SPORTS B PLAYITAGAINSPID", "amount": 745.00, "type": "expense", "balance": 1964.17 },
          { "date": "2025-10-23", "description": "AMAZON MKTPL*NU6OO0IF0 Amzn.com/billWA", "amount": 37.09, "type": "expense", "balance": 2001.26 },
          { "date": "2025-10-23", "description": "NORTHWEST PETS EAGLE EAGLE ID", "amount": 18.00, "type": "expense", "balance": 2019.26 },
          { "date": "2025-10-23", "description": "THE HOME DEPOT #1809 EAGLE ID", "amount": 2.63, "type": "expense", "balance": 2021.89 },
          { "date": "2025-10-24", "description": "MCDONALD'S F19731 EAGLE ID", "amount": 1.48, "type": "expense", "balance": 2023.37 },
          { "date": "2025-10-24", "description": "FREDDY'S 77-0006 EAGLE ID", "amount": 34.08, "type": "expense", "balance": 2057.45 },
          { "date": "2025-10-25", "description": "CTLP*SCHEELS INC FARGO ND", "amount": 1.00, "type": "expense", "balance": 2058.45 },
          { "date": "2025-10-25", "description": "CTLP*SCHEELS INC FARGO ND", "amount": 1.00, "type": "expense", "balance": 2059.45 },
          { "date": "2025-10-25", "description": "CTLP*SCHEELS INC FARGO ND", "amount": 1.00, "type": "expense", "balance": 2060.45 },
          { "date": "2025-10-25", "description": "CTLP*SCHEELS INC FARGO ND", "amount": 1.00, "type": "expense", "balance": 2061.45 },
          { "date": "2025-10-25", "description": "CHICK-FIL-A #05545 MERIDIAN ID", "amount": 13.67, "type": "expense", "balance": 2075.12 },
          { "date": "2025-10-25", "description": "AMAZON PRIME*NU9S45Q82 amzn.com/billWA", "amount": 2.99, "type": "expense", "balance": 2078.11 },
          { "date": "2025-10-25", "description": "AMAZON MKTPL*N41L72EC0 Amzn.com/billWA", "amount": 8.96, "type": "expense", "balance": 2087.07 },
          { "date": "2025-10-25", "description": "SQ *WILD THINGS COFFEE COMeridian ID", "amount": 11.93, "type": "expense", "balance": 2099.00 },
          { "date": "2025-10-25", "description": "AMAZON MKTPL*N44P79EG0 Amzn.com/billWA", "amount": 20.12, "type": "expense", "balance": 2119.12 },
          { "date": "2025-10-25", "description": "Scheels Meridian Meridian ID", "amount": 395.34, "type": "expense", "balance": 2514.46 },
          { "date": "2025-10-26", "description": "IC* INSTACART INSTACART.COMCA", "amount": 172.30, "type": "expense", "balance": 2686.76 },
          { "date": "2025-10-26", "description": "IC* COSTCO BY INSTACAR 888-2467822 CA", "amount": 220.86, "type": "expense", "balance": 2907.62 },
          { "date": "2025-10-27", "description": "READ WITH ELLO ELLO.COM CA", "amount": 14.99, "type": "expense", "balance": 2922.61 },
          { "date": "2025-10-27", "description": "BATTLE BORN COFFEE SHOP WINNEMUCCA NV", "amount": 11.83, "type": "expense", "balance": 2934.44 },
          { "date": "2025-10-27", "description": "DUTCH BROS CA1502 GRANITE BAY CA", "amount": 12.00, "type": "expense", "balance": 2946.44 },
          { "date": "2025-10-27", "description": "AMAZON MKTPL*N426D92Z0 Amzn.com/billWA", "amount": 6.99, "type": "expense", "balance": 2953.43 },
          { "date": "2025-10-27", "description": "Amazon.com*N41VA5601 Amzn.com/billWA", "amount": 14.83, "type": "expense", "balance": 2968.26 },
          { "date": "2025-10-27", "description": "Amazon.com*N43UM7F82 Amzn.com/billWA", "amount": 15.87, "type": "expense", "balance": 2984.13 },
          { "date": "2025-10-27", "description": "AMAZON MKTPL*N40HA5DQ0 Amzn.com/billWA", "amount": 20.13, "type": "expense", "balance": 3004.26 },
          { "date": "2025-10-27", "description": "AMAZON MKTPL*N43PN8Q41 Amzn.com/billWA", "amount": 29.56, "type": "expense", "balance": 3033.82 },
          { "date": "2025-10-27", "description": "MRS ZS JORDAN VALLEYOR", "amount": 5.55, "type": "expense", "balance": 3039.37 },
          { "date": "2025-10-27", "description": "ONLINE PAYMENT, THANK YOU", "amount": 1809.72, "type": "income", "balance": 1229.65 },
          { "date": "2025-10-28", "description": "NUGGET MARKET #18 GRANITE BAY CA", "amount": 27.18, "type": "expense", "balance": 1256.83 },
          { "date": "2025-10-28", "description": "IN-N-OUT FOLSOM FOLSOM CA", "amount": 11.58, "type": "expense", "balance": 1268.41 },
          { "date": "2025-10-29", "description": "Kindle Svcs*N42AA10Y2 888-802-3080 WA", "amount": 0.99, "type": "expense", "balance": 1269.40 },
          { "date": "2025-10-29", "description": "SQ *BREW 95 WINNEMUCCA NV", "amount": 6.66, "type": "expense", "balance": 1276.06 },
          { "date": "2025-10-30", "description": "IC* INSTACART 888-246-7822 CA", "amount": 10.89, "type": "expense", "balance": 1286.95 },
          { "date": "2025-10-30", "description": "IC* INSTACART 888-246-7822 CA", "amount": 116.32, "type": "expense", "balance": 1403.27 },
          { "date": "2025-10-30", "description": "EVOLUTION INTEGRATIVE MEDEAGLE ID", "amount": 171.58, "type": "expense", "balance": 1574.85 },
          { "date": "2025-10-31", "description": "ORIGIN FINANCIAL USEORIGIN.COMMA", "amount": 1.00, "type": "expense", "balance": 1575.85 },
          { "date": "2025-10-31", "description": "THE HOME DEPOT #1809 EAGLE ID", "amount": 69.41, "type": "income", "balance": 1506.44 },
          { "date": "2025-11-01", "description": "THE HOME DEPOT #1809 EAGLE ID", "amount": 69.41, "type": "income", "balance": 1437.03 },
          { "date": "2025-11-02", "description": "FH* IDAHO SLEIGH RIDES IDAHOSLEIGHRIID", "amount": 448.00, "type": "expense", "balance": 1885.03 },
          { "date": "2025-11-02", "description": "STARBUCKS STORE 03236 EAGLE ID", "amount": 6.94, "type": "expense", "balance": 1891.97 },
          { "date": "2025-11-02", "description": "IC* INSTACART 888-2467822 CA", "amount": 204.84, "type": "expense", "balance": 2096.81 },
          { "date": "2025-11-03", "description": "ONLINE PAYMENT, THANK YOU", "amount": 1574.85, "type": "income", "balance": 521.96 },
          { "date": "2025-11-03", "description": "AMAZON MKTPLACE PMTS Amzn.com/billWA", "amount": 14.83, "type": "income", "balance": 507.13 },
          { "date": "2025-11-04", "description": "MCDONALD'S F39880 STAR ID", "amount": 1.58, "type": "expense", "balance": 508.71 },
          { "date": "2025-11-04", "description": "AMAZON MKTPL*NK4IP1951 Amzn.com/billWA", "amount": 40.82, "type": "expense", "balance": 549.53 },
          { "date": "2025-11-04", "description": "PLAYITAGAINSP #11218 BOISE ID", "amount": 105.93, "type": "expense", "balance": 655.46 },
          { "date": "2025-11-05", "description": "AMAZON MKTPL*BT7KE8FS0 Amzn.com/billWA", "amount": 24.91, "type": "expense", "balance": 680.37 },
          { "date": "2025-11-05", "description": "Amazon.com*BT8LQ7NB0 Amzn.com/billWA", "amount": 26.73, "type": "expense", "balance": 707.10 },
          { "date": "2025-11-05", "description": "AMAZON MKTPL*BT9UF9OS1 Amzn.com/billWA", "amount": 48.75, "type": "expense", "balance": 755.85 },
          { "date": "2025-11-05", "description": "AMAZON MKTPL*BT4EV0FN1 Amzn.com/billWA", "amount": 56.37, "type": "expense", "balance": 812.22 },
          { "date": "2025-11-05", "description": "AMAZON MKTPL*NK93N2QO2 Amzn.com/billWA", "amount": 146.20, "type": "expense", "balance": 958.42 },
          { "date": "2025-11-07", "description": "AMAZON PRIME*430EP7DS3 Amzn.com/billWA", "amount": 149.77, "type": "expense", "balance": 1108.19 },
          { "date": "2025-11-08", "description": "AIR1 888-937-2471 CA", "amount": 15.00, "type": "expense", "balance": 1123.19 },
          { "date": "2025-11-08", "description": "SQ *FORM & FUNCTION COFFEEagle ID", "amount": 24.91, "type": "expense", "balance": 1148.10 },
          { "date": "2025-11-10", "description": "IC* INSTACART 888-246-7822 CA", "amount": 114.62, "type": "expense", "balance": 1262.72 },
          { "date": "2025-11-10", "description": "ONLINE PAYMENT, THANK YOU", "amount": 1097.24, "type": "income", "balance": 165.48 },
          { "date": "2025-11-11", "description": "SP OLLIE OLLIESMILE.COMI", "amount": 27.78, "type": "expense", "balance": 193.26 },
          { "date": "2025-11-11", "description": "AIRBNB * HMFRYZDRPX AIRBNB.COM CA", "amount": 7371.99, "type": "expense", "balance": 7565.25 },
          { "date": "2025-11-11", "description": "SQ *DK LONG DONUTS, LLC Boise ID", "amount": 7.97, "type": "expense", "balance": 7573.22 },
          { "date": "2025-11-12", "description": "PY *WEST ADA SCHOOL DISTR916-467-4700 ID", "amount": 207.90, "type": "expense", "balance": 7781.12 },
          { "date": "2025-11-13", "description": "NORTHWEST PETS EAGLE EAGLE ID", "amount": 18.00, "type": "expense", "balance": 7799.12 },
          { "date": "2025-11-14", "description": "DNC BOISE AIRPORT BOISE ID", "amount": 20.12, "type": "expense", "balance": 7819.24 },
          { "date": "2025-11-14", "description": "BOI Sawtooth Essential Boise ID", "amount": 12.58, "type": "expense", "balance": 7831.82 },
          { "date": "2025-11-15", "description": "IC* INSTACART INSTACART.COMCA", "amount": 7.60, "type": "expense", "balance": 7839.42 },
          { "date": "2025-11-15", "description": "IC* INSTACART INSTACART.COMCA", "amount": 95.45, "type": "expense", "balance": 7934.87 },
          { "date": "2025-11-15", "description": "IC* INSTACART 888-246-7822 CA", "amount": 40.22, "type": "expense", "balance": 7975.09 },
          { "date": "2025-11-15", "description": "LITTLE BIRD SB SANTA BARBARACA", "amount": 37.28, "type": "expense", "balance": 8012.37 },
          { "date": "2025-11-15", "description": "WABI SABI SANTA BARBARACA", "amount": 69.60, "type": "expense", "balance": 8081.97 },
          { "date": "2025-11-15", "description": "SQ *MCCONNELL'S FINE ICE Santa BarbaraCA", "amount": 18.00, "type": "expense", "balance": 8099.97 },
          { "date": "2025-11-16", "description": "7-ELEVEN 13900 SANTA BARBARACA", "amount": 3.58, "type": "expense", "balance": 8103.55 },
          { "date": "2025-11-16", "description": "TST* JEANNINE'S AT THE SHSANTA BARBARACA", "amount": 12.92, "type": "expense", "balance": 8116.47 },
          { "date": "2025-11-16", "description": "TST* JEANNINE'S AT THE SHSANTA BARBARACA", "amount": 79.51, "type": "expense", "balance": 8195.98 },
          { "date": "2025-11-16", "description": "MCDONALD'S F16305 SANTA BARBARACA", "amount": 26.07, "type": "expense", "balance": 8222.05 },
          { "date": "2025-11-16", "description": "SQ *HALEY HIDEOUT LLC Santa BarbaraCA", "amount": 6.75, "type": "expense", "balance": 8228.80 },
          { "date": "2025-11-16", "description": "TST*CORAZON COCINA Santa BarbaraCA", "amount": 8.40, "type": "expense", "balance": 8237.20 },
          { "date": "2025-11-16", "description": "TST*THIRD WINDOW BREWING Santa BarbaraCA", "amount": 71.21, "type": "expense", "balance": 8308.41 },
          { "date": "2025-11-17", "description": "SEOULMATE KITCHEN SANTA BARBARACA", "amount": 19.34, "type": "expense", "balance": 8327.75 },
          { "date": "2025-11-17", "description": "TARGET 00032987 SANTA BARBARACA", "amount": 88.02, "type": "expense", "balance": 8415.77 },
          { "date": "2025-11-17", "description": "SQ *RORI'S ARTISANAL CREASanta BarbaraCA", "amount": 10.50, "type": "expense", "balance": 8426.27 },
          { "date": "2025-11-17", "description": "SQ *SANTA BARBARA AIRPORTSanta BarbaraCA", "amount": 30.26, "type": "expense", "balance": 8456.53 },
          { "date": "2025-11-17", "description": "ONLINE PAYMENT, THANK YOU", "amount": 7919.94, "type": "income", "balance": 536.59 },
          { "date": "2025-11-17", "description": "IC* INSTACART SAN FRANCISCOCA", "amount": 9.69, "type": "income", "balance": 526.90 },
          { "date": "2025-11-17", "description": "TARGET 00032987 SANTA BARBARACA", "amount": 38.22, "type": "income", "balance": 488.68 },
          { "date": "2025-11-18", "description": "Statement Closing Balance", "amount": 0, "type": "expense", "balance": 627.50 }
        ]
      }
    ]
  }
};

const ICCU_SIMULATION_DATA = {
  "iccu_nov": {
    "statement_month": "nov",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1812",
        "account_type": "savings",
        "account_name": "Share Savings",
        "beginning_balance": 3910.04,
        "ending_balance": 4272.64,
        "transactions": [
          { "date": "2025-11-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 3910.04 },
          { "date": "2025-11-03", "description": "Withdrawal #119802569# Transfer To *****9529 contribution", "amount": 2885.04, "type": "expense", "balance": 1025.00 },
          { "date": "2025-11-03", "description": "Deposit", "amount": 8500.00, "type": "income", "balance": 9525.00 },
          { "date": "2025-11-03", "description": "ACH Withdrawal COINBASE INC. - 887C4F4F", "amount": 29.99, "type": "expense", "balance": 9495.01 },
          { "date": "2025-11-05", "description": "Withdrawal #96638468# Ext Xfer To ******8930 Grandma", "amount": 200.00, "type": "expense", "balance": 9295.01 },
          { "date": "2025-11-12", "description": "Withdrawal #120290479# Transfer To *****9817", "amount": 2000.00, "type": "expense", "balance": 7295.01 },
          { "date": "2025-11-17", "description": "Withdrawal #120510921# Transfer To *****9817", "amount": 4000.00, "type": "expense", "balance": 3295.01 },
          { "date": "2025-11-19", "description": "Descriptive Deposit Mobile Deposit", "amount": 1612.75, "type": "income", "balance": 4907.76 },
          { "date": "2025-11-25", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 163.32, "type": "expense", "balance": 4744.44 },
          { "date": "2025-11-28", "description": "Withdrawal #121015297# Transfer To *****1927 japio reimbusement carpet", "amount": 469.80, "type": "expense", "balance": 4274.64 },
          { "date": "2025-11-30", "description": "Excessive Withdrawal Fee", "amount": 2.00, "type": "expense", "balance": 4272.64 }
        ]
      },
      {
        "last_four": "9817",
        "account_type": "checking",
        "account_name": "Central Checking",
        "beginning_balance": 4049.18,
        "ending_balance": 6783.19,
        "transactions": [
          { "date": "2025-11-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 4049.18 },
          { "date": "2025-11-03", "description": "Deposit #119802237# Transfer From *****0685 distribution", "amount": 6000.00, "type": "income", "balance": 10049.18 },
          { "date": "2025-11-04", "description": "ACH Withdrawal CHRISTIAN HEALTH - CHMINISTRI", "amount": 861.00, "type": "expense", "balance": 9188.18 },
          { "date": "2025-11-04", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 393.73, "type": "expense", "balance": 8794.45 },
          { "date": "2025-11-04", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1574.85, "type": "expense", "balance": 7219.60 },
          { "date": "2025-11-04", "description": "ACH Withdrawal PSN*DRY CREEK WA TER CO. LLC - WATER PAYM", "amount": 75.84, "type": "expense", "balance": 7143.76 },
          { "date": "2025-11-04", "description": "ACH Withdrawal PSN*DRY CREEK SE WER CO LLC - SEWER PAYM", "amount": 92.25, "type": "expense", "balance": 7051.51 },
          { "date": "2025-11-10", "description": "ACH Withdrawal ADA COUNTY - BILLINGSER", "amount": 58.69, "type": "expense", "balance": 6992.82 },
          { "date": "2025-11-10", "description": "Check 91", "amount": 1420.24, "type": "expense", "balance": 5572.58 },
          { "date": "2025-11-12", "description": "Point Of Sale Withdrawal 554402050098706 EVOLUTION INTEGRATIVE M208-917-2928 IDUS", "amount": 918.00, "type": "expense", "balance": 4654.58 },
          { "date": "2025-11-12", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 3036.31, "type": "expense", "balance": 1618.27 },
          { "date": "2025-11-12", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1097.24, "type": "expense", "balance": 521.03 },
          { "date": "2025-11-12", "description": "Deposit #120290479# Transfer From *****1812", "amount": 2000.00, "type": "income", "balance": 2521.03 },
          { "date": "2025-11-13", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 895.00, "type": "expense", "balance": 1626.03 },
          { "date": "2025-11-14", "description": "ACH Withdrawal INTERMOUNTAIN GA - PAYMENTS", "amount": 56.12, "type": "expense", "balance": 1569.91 },
          { "date": "2025-11-17", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 135.00, "type": "expense", "balance": 1434.91 },
          { "date": "2025-11-17", "description": "Deposit #120510921# Transfer From *****1812", "amount": 4000.00, "type": "income", "balance": 5434.91 },
          { "date": "2025-11-17", "description": "Deposit #120511763# Transfer From *****0685 distribution", "amount": 10000.00, "type": "income", "balance": 15434.91 },
          { "date": "2025-11-18", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 1216.94, "type": "expense", "balance": 14217.97 },
          { "date": "2025-11-18", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 7919.94, "type": "expense", "balance": 6298.03 },
          { "date": "2025-11-19", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 60.00, "type": "expense", "balance": 6238.03 },
          { "date": "2025-11-20", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 22.00, "type": "expense", "balance": 6216.03 },
          { "date": "2025-11-25", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 2306.28, "type": "expense", "balance": 3909.75 },
          { "date": "2025-11-25", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1080.94, "type": "expense", "balance": 2828.81 },
          { "date": "2025-11-26", "description": "Point Of Sale Withdrawal 295618 CASH APP*DAYNELIS HERNAOakland CAUS", "amount": 160.00, "type": "expense", "balance": 2668.81 },
          { "date": "2025-11-28", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 200.00, "type": "expense", "balance": 2468.81 },
          { "date": "2025-11-28", "description": "ACH Withdrawal IDAHO POWER CO. 800-488-6151 - POWER BILL", "amount": 85.62, "type": "expense", "balance": 2383.19 },
          { "date": "2025-11-30", "description": "Descriptive Deposit Mobile Deposit", "amount": 602.00, "type": "income", "balance": 2985.19 },
          { "date": "2025-11-30", "description": "Descriptive Deposit Mobile Deposit", "amount": 3798.00, "type": "income", "balance": 6783.19 }
        ]
      }
    ]
  }
};

export async function getAvailableInstitutions() {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching institutions:', error);
    throw error;
  }

  return data;
}

export async function getInstitutionById(institutionId) {
  const { data, error } = await supabase
    .from('financial_institutions')
    .select('*')
    .eq('id', institutionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching institution:', error);
    throw error;
  }

  return data;
}

export async function simulateConnection(institutionId, profileId = null) {
  await new Promise(resolve => setTimeout(resolve, 1500));

  const institution = await getInstitutionById(institutionId);

  if (!institution) {
    throw new Error('Institution not found');
  }

  if (institution.name.toLowerCase().includes('idaho central') ||
      institution.name.toLowerCase().includes('american express') ||
      institution.name.toLowerCase().includes('citi')) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !profileId) {
      return {
        success: true,
        institutionId,
        institutionName: institution.name
      };
    }

    return {
      success: true,
      institutionId,
      institutionName: institution.name,
      profileId
    };
  }

  throw new Error('Only ICCU, American Express, and Citibank are supported in simulation mode');
}

export async function getInstitutionAccounts(institutionId, profileId = null) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const institution = await getInstitutionById(institutionId);

  if (!institution) {
    return [];
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  let simulationData = null;

  if (institution.name.toLowerCase().includes('idaho central')) {
    simulationData = ICCU_SIMULATION_DATA;
  } else if (institution.name.toLowerCase().includes('american express')) {
    simulationData = AMEX_SIMULATION_DATA;
  } else if (institution.name.toLowerCase().includes('citi')) {
    simulationData = CITI_SIMULATION_DATA;
  } else {
    return [];
  }

  const accountsByLast4 = {};

  Object.values(simulationData).forEach(monthData => {
    monthData.accounts.forEach(account => {
      if (!accountsByLast4[account.last_four]) {
        accountsByLast4[account.last_four] = {
          id: `sim_${account.last_four}`,
          name: account.account_name,
          type: account.account_type,
          last_four: account.last_four,
          current_balance: account.ending_balance,
          beginning_balance: null,
          institution_name: institution.name,
          institution_id: institutionId,
          transaction_count: 0,
          date_range: { start: null, end: null }
        };
      }
    });
  });

  const sortedMonths = Object.entries(simulationData).sort((a, b) => {
    const monthOrder = { sep: 9, oct: 10, nov: 11, dec: 12 };
    const dateA = `${a[1].statement_year}-${String(monthOrder[a[1].statement_month] || 1).padStart(2, '0')}`;
    const dateB = `${b[1].statement_year}-${String(monthOrder[b[1].statement_month] || 1).padStart(2, '0')}`;
    return dateA.localeCompare(dateB);
  });

  sortedMonths.forEach(([key, monthData], index) => {
    monthData.accounts.forEach(account => {
      const acc = accountsByLast4[account.last_four];
      if (acc) {
        acc.transaction_count += account.transactions.length;
        acc.current_balance = account.ending_balance;

        if (index === 0 && account.beginning_balance !== undefined) {
          acc.beginning_balance = account.beginning_balance;
        }

        account.transactions.forEach(txn => {
          if (!acc.date_range.start || txn.date < acc.date_range.start) {
            acc.date_range.start = txn.date;
          }
          if (!acc.date_range.end || txn.date > acc.date_range.end) {
            acc.date_range.end = txn.date;
          }
        });
      }
    });
  });

  return Object.values(accountsByLast4);
}

export async function getAccountTransactions(accountId, institutionId) {
  await new Promise(resolve => setTimeout(resolve, 500));

  const institution = await getInstitutionById(institutionId);

  if (!institution) {
    return [];
  }

  let simulationData = null;

  if (institution.name.toLowerCase().includes('idaho central')) {
    simulationData = ICCU_SIMULATION_DATA;
  } else if (institution.name.toLowerCase().includes('american express')) {
    simulationData = AMEX_SIMULATION_DATA;
  } else if (institution.name.toLowerCase().includes('citi')) {
    simulationData = CITI_SIMULATION_DATA;
  } else {
    return [];
  }

  const last4 = accountId.replace('sim_', '');
  const allTransactions = [];

  Object.values(simulationData).forEach(monthData => {
    const accountData = monthData.accounts.find(acc => acc.last_four === last4);
    if (accountData) {
      const filteredTransactions = accountData.transactions.filter(txn =>
        txn.description !== 'Beginning Balance' &&
        txn.description !== 'Statement Closing Balance'
      );
      allTransactions.push(...filteredTransactions);
    }
  });

  allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  return allTransactions;
}

export async function getAccountSummary(accountId, institutionId) {
  const transactions = await getAccountTransactions(accountId, institutionId);
  const accounts = await getInstitutionAccounts(institutionId);
  const account = accounts.find(acc => acc.id === accountId);

  if (!account) {
    throw new Error('Account not found');
  }

  return {
    id: accountId,
    name: account.name,
    type: account.type,
    last_four: account.last_four,
    current_balance: account.current_balance,
    transaction_count: transactions.length,
    date_range: account.date_range,
    transactions
  };
}
