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
  "amex_nov": {
    "statement_month": "nov",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "3008",
        "account_type": "credit_card",
        "account_name": "Delta SkyMiles® Gold Card",
        "beginning_balance": -4112.10,
        "ending_balance": -2455.46,
        "transactions": [
          { "date": "2025-11-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -4112.10 },
          { "date": "2025-11-02", "description": "SP DWELL HOME CO.", "amount": 38.14, "type": "expense", "balance": -4150.24 },
          { "date": "2025-11-02", "description": "AplPay SP OLIVE TREE PEOPLE", "amount": 99.24, "type": "expense", "balance": -4249.48 },
          { "date": "2025-11-03", "description": "EVOLUTION INTEGRATIVE", "amount": 207.98, "type": "expense", "balance": -4457.46 },
          { "date": "2025-11-03", "description": "POTTERY BARN KIDS", "amount": 59.79, "type": "expense", "balance": -4517.25 },
          { "date": "2025-11-03", "description": "AplPay VIBRANT LAB TESTING", "amount": 1040.00, "type": "expense", "balance": -5557.25 },
          { "date": "2025-11-03", "description": "ONLINE PAYMENT - THANK YOU", "amount": 393.73, "type": "income", "balance": -5163.52 },
          { "date": "2025-11-04", "description": "SP BALLERINA FARM", "amount": 71.60, "type": "expense", "balance": -5235.12 },
          { "date": "2025-11-04", "description": "SP VIO2TAPE", "amount": 24.95, "type": "expense", "balance": -5260.07 },
          { "date": "2025-11-04", "description": "TURO INC.* TRIP NOV 14", "amount": 361.82, "type": "expense", "balance": -5621.89 },
          { "date": "2025-11-05", "description": "GEICO AUTO", "amount": 436.97, "type": "expense", "balance": -6058.86 },
          { "date": "2025-11-05", "description": "LIGHT AFRICA", "amount": 67.00, "type": "expense", "balance": -6125.86 },
          { "date": "2025-11-05", "description": "SP GEM JOLIE", "amount": 61.11, "type": "expense", "balance": -6186.97 },
          { "date": "2025-11-06", "description": "KARVE", "amount": 25.00, "type": "expense", "balance": -6211.97 },
          { "date": "2025-11-10", "description": "CRATE & BARREL/CB2 914", "amount": 434.75, "type": "income", "balance": -5777.22 },
          { "date": "2025-11-10", "description": "ONLINE PAYMENT - THANK YOU", "amount": 3036.31, "type": "income", "balance": -2740.91 },
          { "date": "2025-11-12", "description": "AIRWALXUK*LITFAD ORDER 1185062 AIRWALX", "amount": 32.13, "type": "income", "balance": -2708.78 },
          { "date": "2025-11-13", "description": "CRATE & BARREL/CB2 914", "amount": 114.80, "type": "income", "balance": -2593.98 },
          { "date": "2025-11-13", "description": "TARGET.COM", "amount": 21.20, "type": "income", "balance": -2572.78 },
          { "date": "2025-11-06", "description": "AplPay ZARA USA INC.", "amount": 427.26, "type": "expense", "balance": -2145.52 },
          { "date": "2025-11-08", "description": "AplPay AWX*UNIFITSTYLE 980000001559397", "amount": 58.59, "type": "expense", "balance": -2204.11 },
          { "date": "2025-11-10", "description": "AplPay TST* AUBERGINE KITCHEN - 00249509", "amount": 70.86, "type": "expense", "balance": -2274.97 },
          { "date": "2025-11-10", "description": "SP MADEINCOOKWARE", "amount": 846.94, "type": "expense", "balance": -3121.91 },
          { "date": "2025-11-11", "description": "POLISH PERFECT", "amount": 102.00, "type": "expense", "balance": -3223.91 },
          { "date": "2025-11-11", "description": "AplPay MY FATHERS PLACE", "amount": 51.36, "type": "expense", "balance": -3275.27 },
          { "date": "2025-11-12", "description": "AplPay APPLE.COM/BILL", "amount": 3.99, "type": "expense", "balance": -3279.26 },
          { "date": "2025-11-12", "description": "KARVE", "amount": 229.00, "type": "expense", "balance": -3508.26 },
          { "date": "2025-11-13", "description": "AplPay SP DWELL HOME CO.", "amount": 434.48, "type": "expense", "balance": -3942.74 },
          { "date": "2025-11-13", "description": "CRATE & BARREL", "amount": 549.55, "type": "expense", "balance": -4492.29 },
          { "date": "2025-11-16", "description": "AplPay ZARA USA INC.", "amount": 57.85, "type": "expense", "balance": -4550.14 },
          { "date": "2025-11-17", "description": "AplPay THE BLEND SALON", "amount": 43.19, "type": "expense", "balance": -4593.33 },
          { "date": "2025-11-17", "description": "AplPay SALT & LIGHT COFFEE LOUNGE LLC", "amount": 6.63, "type": "expense", "balance": -4599.96 },
          { "date": "2025-11-17", "description": "AplPay VILLAGE AT MERIDIAN ID-AN 000011559", "amount": 371.00, "type": "expense", "balance": -4970.96 },
          { "date": "2025-11-17", "description": "AplPay SP EVEREVE", "amount": 393.26, "type": "expense", "balance": -5364.22 },
          { "date": "2025-11-17", "description": "ONLINE PAYMENT - THANK YOU", "amount": 1216.94, "type": "income", "balance": -4147.28 },
          { "date": "2025-11-18", "description": "AplPay LOWE FAMILY FARMSTEAD", "amount": 5.00, "type": "expense", "balance": -4152.28 },
          { "date": "2025-11-18", "description": "AplPay TST* CHIP COOKIES - MERID 300603803", "amount": 8.18, "type": "expense", "balance": -4160.46 },
          { "date": "2025-11-18", "description": "KARVE", "amount": 5.00, "type": "expense", "balance": -4165.46 },
          { "date": "2025-11-18", "description": "SP TRANSPARENT LABS", "amount": 61.99, "type": "expense", "balance": -4227.45 },
          { "date": "2025-11-24", "description": "SP NUUDS", "amount": 207.76, "type": "expense", "balance": -4435.21 },
          { "date": "2025-11-24", "description": "AplPay APPLE.COM/BILL", "amount": 49.97, "type": "expense", "balance": -4485.18 },
          { "date": "2025-11-24", "description": "ONLINE PAYMENT - THANK YOU", "amount": 2306.28, "type": "income", "balance": -2178.90 },
          { "date": "2025-11-26", "description": "AplPay STELLA'S ICE CREAM - EAGLE", "amount": 28.84, "type": "expense", "balance": -2207.74 },
          { "date": "2025-11-26", "description": "AplPay TST* COSTA VIDA - MERIDIA 300681073", "amount": 20.44, "type": "expense", "balance": -2228.18 },
          { "date": "2025-11-28", "description": "NORDSTROM #0434 000000434", "amount": 445.00, "type": "expense", "balance": -2673.18 },
          { "date": "2025-11-28", "description": "AplPay NORDSTROM #0434 000000434", "amount": 459.00, "type": "expense", "balance": -3132.18 },
          { "date": "2025-11-29", "description": "NORDSTROM DIRECT http://shop.nordstrom", "amount": 83.74, "type": "expense", "balance": -3215.92 },
          { "date": "2025-11-29", "description": "GARDEN OF LIFE LLC - EC", "amount": 32.22, "type": "expense", "balance": -3248.14 },
          { "date": "2025-11-30", "description": "AplPay APPLE.COM/BILL", "amount": 9.99, "type": "expense", "balance": -3258.13 },
          { "date": "2025-11-30", "description": "AplPay BEEHIVEMEAL 8015890591", "amount": 204.73, "type": "expense", "balance": -3462.86 },
          { "date": "2025-12-01", "description": "AplPay FORM & FUNCTION COFFEE - EAGLE", "amount": 24.91, "type": "expense", "balance": -3487.77 },
          { "date": "2025-12-01", "description": "ONLINE PAYMENT - THANK YOU", "amount": 3180.31, "type": "income", "balance": -307.46 }
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
  "citi_sep": {
    "statement_month": "sep",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1733",
        "account_type": "credit_card",
        "account_name": "Citi Costco Credit Card",
        "beginning_balance": -817.17,
        "ending_balance": -850.72,
        "transactions": [
          { "date": "2025-09-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -817.17 },
          { "date": "2025-09-03", "description": "COSTCO WHSE #1234", "amount": 245.67, "type": "expense", "balance": -788.88 },
          { "date": "2025-09-05", "description": "SHELL OIL", "amount": 42.15, "type": "expense", "balance": -831.03 },
          { "date": "2025-09-07", "description": "AMAZON.COM", "amount": 89.99, "type": "expense", "balance": -921.02 },
          { "date": "2025-09-09", "description": "ONLINE PAYMENT, THANK YOU", "amount": 543.21, "type": "income", "balance": -377.81 },
          { "date": "2025-09-12", "description": "TARGET", "amount": 67.43, "type": "expense", "balance": -445.24 },
          { "date": "2025-09-15", "description": "COSTCO GAS", "amount": 58.92, "type": "expense", "balance": -504.16 },
          { "date": "2025-09-18", "description": "RESTAURANT", "amount": 85.50, "type": "expense", "balance": -589.66 },
          { "date": "2025-09-20", "description": "WALGREENS", "amount": 23.45, "type": "expense", "balance": -613.11 },
          { "date": "2025-09-24", "description": "COSTCO WHSE #1234", "amount": 156.89, "type": "expense", "balance": -770.00 },
          { "date": "2025-09-26", "description": "ONLINE PAYMENT, THANK YOU", "amount": 142.50, "type": "income", "balance": -850.72 }
        ]
      }
    ]
  },
  "citi_oct": {
    "statement_month": "oct",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1733",
        "account_type": "credit_card",
        "account_name": "Citi Costco Credit Card",
        "beginning_balance": -850.72,
        "ending_balance": -37.49,
        "transactions": [
          { "date": "2025-10-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -850.72 },
          { "date": "2025-10-03", "description": "COSTCO GAS", "amount": 52.30, "type": "expense", "balance": -679.80 },
          { "date": "2025-10-05", "description": "AMAZON.COM", "amount": 124.67, "type": "expense", "balance": -804.47 },
          { "date": "2025-10-08", "description": "ONLINE PAYMENT, THANK YOU", "amount": 627.50, "type": "income", "balance": -176.97 },
          { "date": "2025-10-10", "description": "GROCERY STORE", "amount": 98.45, "type": "expense", "balance": -275.42 },
          { "date": "2025-10-13", "description": "COSTCO WHSE #1234", "amount": 312.78, "type": "expense", "balance": -588.20 },
          { "date": "2025-10-16", "description": "SHELL OIL", "amount": 45.89, "type": "expense", "balance": -634.09 },
          { "date": "2025-10-19", "description": "RESTAURANT", "amount": 72.15, "type": "expense", "balance": -706.24 },
          { "date": "2025-10-22", "description": "TARGET", "amount": 89.34, "type": "expense", "balance": -795.58 },
          { "date": "2025-10-25", "description": "AMAZON PRIME", "amount": 14.99, "type": "expense", "balance": -810.57 },
          { "date": "2025-10-28", "description": "COSTCO GAS", "amount": 48.77, "type": "expense", "balance": -859.34 },
          { "date": "2025-10-30", "description": "PHARMACY", "amount": 33.00, "type": "expense", "balance": -37.49 }
        ]
      }
    ]
  },
  "citi_nov": {
    "statement_month": "nov",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1733",
        "account_type": "credit_card",
        "account_name": "Citi Costco Credit Card",
        "beginning_balance": -37.49,
        "ending_balance": -627.50,
        "transactions": [
          { "date": "2025-11-01", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -37.49 },
          { "date": "2025-11-04", "description": "ONLINE PAYMENT, THANK YOU", "amount": 892.34, "type": "income", "balance": 0.00 },
          { "date": "2025-11-06", "description": "COSTCO WHSE #1234", "amount": 267.89, "type": "expense", "balance": -267.89 },
          { "date": "2025-11-09", "description": "COSTCO GAS", "amount": 54.23, "type": "expense", "balance": -322.12 },
          { "date": "2025-11-12", "description": "AMAZON.COM", "amount": 156.78, "type": "expense", "balance": -478.90 },
          { "date": "2025-11-15", "description": "RESTAURANT", "amount": 94.32, "type": "expense", "balance": -573.22 },
          { "date": "2025-11-18", "description": "SHELL OIL", "amount": 47.65, "type": "expense", "balance": -620.87 },
          { "date": "2025-11-20", "description": "TARGET", "amount": 112.45, "type": "expense", "balance": -733.32 },
          { "date": "2025-11-23", "description": "COSTCO WHSE #1234", "amount": 198.67, "type": "expense", "balance": -931.99 },
          { "date": "2025-11-25", "description": "HOLIDAY SHOPPING", "amount": 234.56, "type": "expense", "balance": -1166.55 },
          { "date": "2025-11-28", "description": "PHARMACY", "amount": 36.90, "type": "expense", "balance": -627.50 }
        ]
      }
    ]
  },
  "citi_dec": {
    "statement_month": "dec",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1733",
        "account_type": "credit_card",
        "account_name": "Costco Anywhere Visa Card by Citi",
        "beginning_balance": -627.50,
        "ending_balance": -1447.41,
        "transactions": [
          { "date": "2025-11-19", "description": "Beginning Balance", "amount": 0, "type": "expense", "balance": -627.50 },
          { "date": "2025-11-19", "description": "SHELL OIL13142952012 GOLETA CA", "amount": 24.34, "type": "expense", "balance": -651.84 },
          { "date": "2025-11-19", "description": "BURGERS AND BREWS SMF SACRAMENTO CA", "amount": 20.46, "type": "expense", "balance": -672.30 },
          { "date": "2025-11-19", "description": "STARBUCKS STORE 48050 GOLETA CA", "amount": 18.35, "type": "expense", "balance": -690.65 },
          { "date": "2025-11-19", "description": "Prime Video Channels amzn.com/billWA", "amount": 5.99, "type": "expense", "balance": -696.64 },
          { "date": "2025-11-19", "description": "IC* INSTACART INSTACART.COMCA", "amount": 30.75, "type": "expense", "balance": -727.39 },
          { "date": "2025-11-19", "description": "AMAZON MKTPL*B00B96J30 Amzn.com/billWA", "amount": 8.47, "type": "expense", "balance": -735.86 },
          { "date": "2025-11-20", "description": "IC* COSTCO BY IN CAR 888-246-7822 CA", "amount": 312.10, "type": "expense", "balance": -1047.96 },
          { "date": "2025-11-20", "description": "SP BANANA INK BANANA-INK.COID", "amount": 32.98, "type": "expense", "balance": -1080.94 },
          { "date": "2025-11-20", "description": "STARBUCKS STORE 03236 EAGLE ID", "amount": 11.13, "type": "expense", "balance": -1092.07 },
          { "date": "2025-11-21", "description": "AMAZON MKTPL*B04JX09B1 Amzn.com/billWA", "amount": 20.12, "type": "expense", "balance": -1112.19 },
          { "date": "2025-11-21", "description": "Amazon.com*B040X69D1 Amzn.com/billWA", "amount": 24.07, "type": "expense", "balance": -1136.26 },
          { "date": "2025-11-21", "description": "SQ *FORM & FUNCTION COFFEEagle ID", "amount": 28.14, "type": "expense", "balance": -1164.40 },
          { "date": "2025-11-21", "description": "AMAZON MKTPL*B01DL9QA0 Amzn.com/billWA", "amount": 57.23, "type": "expense", "balance": -1221.63 },
          { "date": "2025-11-21", "description": "AMAZON MKTPL*B05DL2QR0 Amzn.com/billWA", "amount": 179.25, "type": "expense", "balance": -1400.88 },
          { "date": "2025-11-22", "description": "IC* INSTACART INSTACART.COMCA", "amount": 176.33, "type": "expense", "balance": -1577.21 },
          { "date": "2025-11-22", "description": "IC* INSTACART SAN FRANCISCOCA", "amount": 6.83, "type": "income", "balance": -1570.38 },
          { "date": "2025-11-23", "description": "IC* INSTACART SAN FRANCISCOCA", "amount": 11.65, "type": "income", "balance": -1558.73 },
          { "date": "2025-11-23", "description": "TST*SEA SALT CREAMERY - Star ID", "amount": 16.96, "type": "expense", "balance": -1575.69 },
          { "date": "2025-11-23", "description": "TST*SEA SALT CREAMERY - Star ID", "amount": 18.49, "type": "expense", "balance": -1594.18 },
          { "date": "2025-11-24", "description": "ONLINE PAYMENT, THANK YOU", "amount": 1080.94, "type": "income", "balance": -513.24 },
          { "date": "2025-11-24", "description": "SP BEIS TRAVEL BEISTRAVEL.COCA", "amount": 100.81, "type": "expense", "balance": -614.05 },
          { "date": "2025-11-24", "description": "SP BAKINGSTEEL.COM BAKINGSTEEL.CMI", "amount": 169.00, "type": "expense", "balance": -783.05 },
          { "date": "2025-11-24", "description": "AMAZON MKTPL*B204R83I2 Amzn.com/billWA", "amount": 11.65, "type": "expense", "balance": -794.70 },
          { "date": "2025-11-24", "description": "AMAZON MKTPL*B29U36TC1 Amzn.com/billWA", "amount": 12.71, "type": "expense", "balance": -807.41 },
          { "date": "2025-11-24", "description": "AMAZON MKTPL*B26RN4C90 Amzn.com/billWA", "amount": 13.56, "type": "expense", "balance": -820.97 },
          { "date": "2025-11-24", "description": "Amazon.com*B21KM7JE1 Amzn.com/billWA", "amount": 13.73, "type": "expense", "balance": -834.70 },
          { "date": "2025-11-25", "description": "IC* COSTCO BY IN CAR 888-246-7822 CA", "amount": 14.42, "type": "expense", "balance": -849.12 },
          { "date": "2025-11-25", "description": "IC* INSTACART 888-246-7822 CA", "amount": 74.19, "type": "expense", "balance": -923.31 },
          { "date": "2025-11-25", "description": "IC* COSTCO BY IN CAR 888-246-7822 CA", "amount": 177.59, "type": "expense", "balance": -1100.90 },
          { "date": "2025-11-25", "description": "CLEANCO CARPET AIR DU info@cleanco-WA", "amount": 469.80, "type": "expense", "balance": -1570.70 },
          { "date": "2025-11-25", "description": "AMAZON PRIME*B23DL5070 amzn.com/billWA", "amount": 2.99, "type": "expense", "balance": -1573.69 },
          { "date": "2025-11-25", "description": "AMAZON MKTPL*B251D9HY2 Amzn.com/billWA", "amount": 15.89, "type": "expense", "balance": -1589.58 },
          { "date": "2025-11-26", "description": "AMAZON MKTPL*B21L16530 Amzn.com/billWA", "amount": 115.24, "type": "expense", "balance": -1704.82 },
          { "date": "2025-11-27", "description": "READ WITH ELLO ELLO.COM CA", "amount": 14.99, "type": "expense", "balance": -1719.81 },
          { "date": "2025-11-27", "description": "ADA COUNTY 888-8916064 ID", "amount": 216.94, "type": "expense", "balance": -1936.75 },
          { "date": "2025-11-27", "description": "AMAZON MKTPL*B25792840 Amzn.com/billWA", "amount": 42.36, "type": "expense", "balance": -1979.11 },
          { "date": "2025-11-27", "description": "IC* INSTACART 888-2467822 CA", "amount": 0.01, "type": "expense", "balance": -1979.12 },
          { "date": "2025-11-27", "description": "IC* INSTACART 888-2467822 CA", "amount": 40.80, "type": "expense", "balance": -2019.92 },
          { "date": "2025-11-28", "description": "SP FENO FENO.CO CA", "amount": 269.24, "type": "expense", "balance": -2289.16 },
          { "date": "2025-11-28", "description": "SP 33THREADS TAVIACTIVE.COCA", "amount": 164.15, "type": "expense", "balance": -2453.31 },
          { "date": "2025-11-28", "description": "FREDDY'S 77-0006 EAGLE ID", "amount": 15.14, "type": "expense", "balance": -2468.45 },
          { "date": "2025-11-28", "description": "FREDDY'S 77-0006 EAGLE ID", "amount": 17.04, "type": "expense", "balance": -2485.49 },
          { "date": "2025-11-28", "description": "AMAZON MKTPL*BB0QV0JU2 Amzn.com/billWA", "amount": 7.41, "type": "expense", "balance": -2492.90 },
          { "date": "2025-11-28", "description": "SQ *VILLAGE AT MERIDIAN gosq.com ID", "amount": 21.20, "type": "expense", "balance": -2514.10 },
          { "date": "2025-11-29", "description": "AMAZON MKTPL*BB8VD5EF2 Amzn.com/billWA", "amount": 6.35, "type": "expense", "balance": -2520.45 },
          { "date": "2025-11-29", "description": "Amazon.com*BB5WW7TK2 Amzn.com/billWA", "amount": 21.03, "type": "expense", "balance": -2541.48 },
          { "date": "2025-11-29", "description": "AMAZON MKTPL*BB9RV3CT0 Amzn.com/billWA", "amount": 31.79, "type": "expense", "balance": -2573.27 },
          { "date": "2025-11-30", "description": "IN-N-OUT MERIDIAN MERIDIAN ID", "amount": 33.00, "type": "expense", "balance": -2606.27 },
          { "date": "2025-12-01", "description": "AIRBNB * HMFRYZDRPX AIRBNB.COM CA", "amount": 1389.62, "type": "expense", "balance": -3995.89 },
          { "date": "2025-12-01", "description": "USPS PO 1526500416 EAGLE ID", "amount": 78.00, "type": "expense", "balance": -4073.89 },
          { "date": "2025-12-01", "description": "ONLINE PAYMENT, THANK YOU", "amount": 2289.16, "type": "income", "balance": -1784.73 },
          { "date": "2025-12-02", "description": "RLI INSURANCE COMPANY 309-692-1000 IL", "amount": 515.00, "type": "expense", "balance": -2299.73 },
          { "date": "2025-12-02", "description": "GYRO SHACK - STATE ST BOISE ID", "amount": 18.59, "type": "expense", "balance": -2318.32 },
          { "date": "2025-12-02", "description": "Amazon.com*BB6IO3KN1 Amzn.com/billWA", "amount": 19.67, "type": "expense", "balance": -2337.99 },
          { "date": "2025-12-02", "description": "Safeco Corporation Boston MA", "amount": 1614.00, "type": "expense", "balance": -3951.99 },
          { "date": "2025-12-04", "description": "IC* COSTCO BY INSTACAR INSTACART.COMCA", "amount": 247.38, "type": "expense", "balance": -4199.37 },
          { "date": "2025-12-04", "description": "AMAZON MKTPL*BI24V9E81 Amzn.com/billWA", "amount": 6.35, "type": "expense", "balance": -4205.72 },
          { "date": "2025-12-04", "description": "AMAZON MKTPL*BI6Z20371 Amzn.com/billWA", "amount": 45.22, "type": "expense", "balance": -4250.94 },
          { "date": "2025-12-05", "description": "SP GIBOARDUS GIBBON-USA.COCA", "amount": 180.19, "type": "expense", "balance": -4431.13 },
          { "date": "2025-12-05", "description": "SQ *BORDERTOWN COFFEE STAStar ID", "amount": 4.18, "type": "expense", "balance": -4435.31 },
          { "date": "2025-12-06", "description": "MCDONALD'S F19731 EAGLE ID", "amount": 15.12, "type": "expense", "balance": -4450.43 },
          { "date": "2025-12-06", "description": "Amazon.com*BI8H121L0 Amzn.com/billWA", "amount": 10.46, "type": "expense", "balance": -4460.89 },
          { "date": "2025-12-06", "description": "Amazon.com*BI5JY01A0 Amzn.com/billWA", "amount": 13.77, "type": "expense", "balance": -4474.66 },
          { "date": "2025-12-06", "description": "AMAZON MKTPL*BI11X31D0 Amzn.com/billWA", "amount": 14.83, "type": "expense", "balance": -4489.49 },
          { "date": "2025-12-07", "description": "59608 BSU CONCESSIONS BOISE ID", "amount": 5.30, "type": "expense", "balance": -4494.79 },
          { "date": "2025-12-07", "description": "SP INTUITION LLC 120-84810770 ID", "amount": 241.68, "type": "expense", "balance": -4736.47 },
          { "date": "2025-12-08", "description": "SP MELTAIL MELTAIL.COM NV", "amount": 109.99, "type": "expense", "balance": -4846.46 },
          { "date": "2025-12-08", "description": "MCDONALD'S F19731 EAGLE ID", "amount": 9.84, "type": "expense", "balance": -4856.30 },
          { "date": "2025-12-08", "description": "SQ *SALT & LIGHT COFFEE LEAGLE ID", "amount": 11.93, "type": "expense", "balance": -4868.23 },
          { "date": "2025-12-08", "description": "AIR1 888-937-2471 CA", "amount": 15.00, "type": "expense", "balance": -4883.23 },
          { "date": "2025-12-08", "description": "ONLINE PAYMENT, THANK YOU", "amount": 4250.94, "type": "income", "balance": -632.29 },
          { "date": "2025-12-09", "description": "REDLANS GENTLEMENS GRO 120-89953409 ID", "amount": 279.60, "type": "expense", "balance": -911.89 },
          { "date": "2025-12-09", "description": "ZIDAHO.COM 208-724-5860 ID", "amount": 5.00, "type": "expense", "balance": -916.89 },
          { "date": "2025-12-09", "description": "SQ *SALT & LIGHT COFFEE LEAGLE ID", "amount": 26.65, "type": "expense", "balance": -943.54 },
          { "date": "2025-12-09", "description": "AMAZON MKTPL*BW5JH9OA0 Amzn.com/billWA", "amount": 39.78, "type": "expense", "balance": -983.32 },
          { "date": "2025-12-10", "description": "IC* INSTACART 888-246-7822 CA", "amount": 166.32, "type": "expense", "balance": -1149.64 },
          { "date": "2025-12-10", "description": "AMAZON MKTPL*NH42S2CT3 Amzn.com/billWA", "amount": 8.47, "type": "expense", "balance": -1158.11 },
          { "date": "2025-12-10", "description": "Amazon.com*950SL6QA3 Amzn.com/billWA", "amount": 9.99, "type": "expense", "balance": -1168.10 },
          { "date": "2025-12-10", "description": "AMAZON MKTPL*3P9PK5WL3 Amzn.com/billWA", "amount": 14.76, "type": "expense", "balance": -1182.86 },
          { "date": "2025-12-11", "description": "SQ *SALT & LIGHT COFFEE LEAGLE ID", "amount": 20.35, "type": "expense", "balance": -1203.21 },
          { "date": "2025-12-13", "description": "SP LIONS DEN TOYS BOOK 120-87890389 ID", "amount": 284.97, "type": "expense", "balance": -1488.18 },
          { "date": "2025-12-13", "description": "TST*SPITFIRE TACOS AND T 208-992-5977 ID", "amount": 13.78, "type": "expense", "balance": -1501.96 },
          { "date": "2025-12-14", "description": "PRICELINE.COM USD PRICELINE.COMCT", "amount": 651.36, "type": "expense", "balance": -2153.32 },
          { "date": "2025-12-14", "description": "AMAZON MKTPL*RO3EL65S3 Amzn.com/billWA", "amount": 11.52, "type": "expense", "balance": -2164.84 },
          { "date": "2025-12-14", "description": "AMAZON MKTPL*YV4P17HQ3 Amzn.com/billWA", "amount": 21.07, "type": "expense", "balance": -2185.91 },
          { "date": "2025-12-15", "description": "SP LIONS DEN TOYS BOOK 120-87890389 ID", "amount": 100.65, "type": "expense", "balance": -2286.56 },
          { "date": "2025-12-15", "description": "IC* INSTACART INSTACART.COMCA", "amount": 194.55, "type": "expense", "balance": -2481.11 },
          { "date": "2025-12-15", "description": "SQ *SALT & LIGHT COFFEE LEAGLE ID", "amount": 7.15, "type": "expense", "balance": -2488.26 },
          { "date": "2025-12-15", "description": "AMAZON MKTPL*BM4BQ6YK3 Amzn.com/billWA", "amount": 9.38, "type": "expense", "balance": -2497.64 },
          { "date": "2025-12-15", "description": "Amazon.com*AW1JP09A3 Amzn.com/billWA", "amount": 107.42, "type": "expense", "balance": -2605.06 },
          { "date": "2025-12-15", "description": "ONLINE PAYMENT, THANK YOU", "amount": 1203.21, "type": "income", "balance": -1401.85 },
          { "date": "2025-12-16", "description": "AMAZON MKTPL*R77T67JR3 Amzn.com/billWA", "amount": 45.56, "type": "expense", "balance": -1447.41 }
        ]
      }
    ]
  }
};

const ICCU_SIMULATION_DATA = {
  "iccu_sep": {
    "statement_month": "sep",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1812",
        "account_type": "savings",
        "account_name": "Share Savings",
        "beginning_balance": 22002.63,
        "ending_balance": 2726.96,
        "transactions": [
          { "date": "2025-09-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 22002.63 },
          { "date": "2025-09-03", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 12000.00, "type": "expense", "balance": 10002.63 },
          { "date": "2025-09-03", "description": "ACH Withdrawal COINBASE INC. - 791B0906", "amount": 29.99, "type": "expense", "balance": 9972.64 },
          { "date": "2025-09-05", "description": "Withdrawal #116927385# Transfer To *****9817 Transfer", "amount": 5000.00, "type": "expense", "balance": 4972.64 },
          { "date": "2025-09-05", "description": "Withdrawal #91670175# Ext Xfer To ******8930 Grandma", "amount": 200.00, "type": "expense", "balance": 4772.64 },
          { "date": "2025-09-11", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 2000.00, "type": "expense", "balance": 2772.64 },
          { "date": "2025-09-24", "description": "Real Time Payment Deposit RTP Credit from WEALTHFRONT BROKERAGE LLC", "amount": 5000.00, "type": "income", "balance": 7772.64 },
          { "date": "2025-09-24", "description": "Withdrawal #117813858# Transfer To *****9529 contribution", "amount": 1800.00, "type": "expense", "balance": 5972.64 },
          { "date": "2025-09-26", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 2991.68, "type": "expense", "balance": 2980.96 },
          { "date": "2025-09-30", "description": "ACH Withdrawal Wealthfront EDI - EDI PYMNTS", "amount": 250.00, "type": "expense", "balance": 2730.96 },
          { "date": "2025-09-30", "description": "Excessive Withdrawal Fee", "amount": 4.00, "type": "expense", "balance": 2726.96 }
        ]
      },
      {
        "last_four": "9817",
        "account_type": "checking",
        "account_name": "Central Checking",
        "beginning_balance": 8227.16,
        "ending_balance": 2609.52,
        "transactions": [
          { "date": "2025-09-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 8227.16 },
          { "date": "2025-09-02", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 2475.00, "type": "expense", "balance": 5752.16 },
          { "date": "2025-09-02", "description": "Withdrawal ZELLE QB81WIOLD GAYLE PARKINSON 4400 CENTRAL WAY CHUBBUCK ID", "amount": 500.00, "type": "expense", "balance": 5252.16 },
          { "date": "2025-09-03", "description": "ACH Withdrawal CHRISTIAN HEALTH - CHMINISTRI", "amount": 861.00, "type": "expense", "balance": 4391.16 },
          { "date": "2025-09-03", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1905.00, "type": "expense", "balance": 2486.16 },
          { "date": "2025-09-03", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 1000.00, "type": "expense", "balance": 1486.16 },
          { "date": "2025-09-05", "description": "Deposit #116927385# Transfer From *****1812 Transfer", "amount": 5000.00, "type": "income", "balance": 6486.16 },
          { "date": "2025-09-09", "description": "Withdrawal ZELLE ZBT1SIKUD GAYLE PARKINSON 4400 CENTRAL WAY CHUBBUCK ID", "amount": 500.00, "type": "expense", "balance": 5986.16 },
          { "date": "2025-09-10", "description": "Deposit #117133581# Transfer From *****0685", "amount": 5000.00, "type": "income", "balance": 10986.16 },
          { "date": "2025-09-10", "description": "Deposit #117133596# Transfer From *****1384 piano", "amount": 250.00, "type": "income", "balance": 11236.16 },
          { "date": "2025-09-10", "description": "Deposit #117133601# Transfer From *****9425 piano", "amount": 250.00, "type": "income", "balance": 11486.16 },
          { "date": "2025-09-10", "description": "Deposit #117133792# Transfer From *****1927 furnace leak elite resto", "amount": 787.94, "type": "income", "balance": 12274.10 },
          { "date": "2025-09-10", "description": "Deposit #117134798# Transfer From *****0685 distribution", "amount": 10000.00, "type": "income", "balance": 22274.10 },
          { "date": "2025-09-11", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 9657.12, "type": "expense", "balance": 12616.98 },
          { "date": "2025-09-11", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 2567.58, "type": "expense", "balance": 10049.40 },
          { "date": "2025-09-12", "description": "Deposit #117242767# Transfer From *****9529 13905 paint", "amount": 52.95, "type": "income", "balance": 10102.35 },
          { "date": "2025-09-12", "description": "Deposit #117243161# Transfer From *****9529 paint", "amount": 190.53, "type": "income", "balance": 10292.88 },
          { "date": "2025-09-12", "description": "Deposit #117243239# Transfer From *****9529 cabinets", "amount": 735.64, "type": "income", "balance": 11028.52 },
          { "date": "2025-09-15", "description": "Check 99", "amount": 4648.00, "type": "expense", "balance": 6380.52 },
          { "date": "2025-09-15", "description": "Descriptive Deposit Mobile Deposit", "amount": 250.00, "type": "income", "balance": 6630.52 },
          { "date": "2025-09-18", "description": "Withdrawal ZELLE ABW1O8H1D DAYNELIS 4400 CENTRAL WAY CHUBBUCK ID", "amount": 160.00, "type": "expense", "balance": 6470.52 },
          { "date": "2025-09-22", "description": "ACH Withdrawal VENMO - PAYMENT", "amount": 1400.00, "type": "expense", "balance": 5070.52 },
          { "date": "2025-09-23", "description": "Withdrawal ZELLE XB11W8P3D GAYLE PARKINSON 4400 CENTRAL WAY CHUBBUCK ID", "amount": 80.00, "type": "expense", "balance": 4990.52 },
          { "date": "2025-09-26", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 2221.00, "type": "expense", "balance": 2769.52 },
          { "date": "2025-09-30", "description": "Withdrawal ZELLE NB61Z8DHD DAYNELIS 4400 CENTRAL WAY CHUBBUCK ID", "amount": 160.00, "type": "expense", "balance": 2609.52 }
        ]
      }
    ]
  },
  "iccu_oct": {
    "statement_month": "oct",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1812",
        "account_type": "savings",
        "account_name": "Share Savings",
        "beginning_balance": 2726.96,
        "ending_balance": 3910.04,
        "transactions": [
          { "date": "2025-10-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 2726.96 },
          { "date": "2025-10-01", "description": "Eff. 09-30 Credit Interest", "amount": 3.41, "type": "income", "balance": 2730.37 },
          { "date": "2025-10-02", "description": "Deposit #118229364# Transfer From *****0685 distribution", "amount": 1000.00, "type": "income", "balance": 3730.37 },
          { "date": "2025-10-02", "description": "Withdrawal #118229407# Transfer To *****1927 reimbursable", "amount": 3000.00, "type": "expense", "balance": 730.37 },
          { "date": "2025-10-03", "description": "ACH Withdrawal COINBASE INC. - 6FCF067F", "amount": 29.99, "type": "expense", "balance": 700.38 },
          { "date": "2025-10-06", "description": "Withdrawal #96638467# Ext Xfer To ******8930 Grandma", "amount": 200.00, "type": "expense", "balance": 500.38 },
          { "date": "2025-10-14", "description": "Real Time Payment Deposit RTP Credit from WEALTHFRONT BROKERAGE LLC", "amount": 10000.00, "type": "income", "balance": 10500.38 },
          { "date": "2025-10-15", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 6340.34, "type": "expense", "balance": 4160.04 },
          { "date": "2025-10-29", "description": "ACH Withdrawal Wealthfront EDI - EDI PYMNTS", "amount": 250.00, "type": "expense", "balance": 3910.04 },
          { "date": "2025-10-30", "description": "Deposit #119589715# Transfer From *****0685 distribution", "amount": 5000.00, "type": "income", "balance": 8910.04 },
          { "date": "2025-10-30", "description": "Withdrawal #119589759# Transfer To *****1927 contribution", "amount": 5000.00, "type": "expense", "balance": 3910.04 }
        ]
      },
      {
        "last_four": "9817",
        "account_type": "checking",
        "account_name": "Central Checking",
        "beginning_balance": 2609.52,
        "ending_balance": 4049.18,
        "transactions": [
          { "date": "2025-10-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 2609.52 },
          { "date": "2025-10-01", "description": "ACH Withdrawal IDAHO POWER CO. 800-488-6151 - POWER BILL", "amount": 86.01, "type": "expense", "balance": 2523.51 },
          { "date": "2025-10-03", "description": "ACH Withdrawal CHRISTIAN HEALTH - CHMINISTRI", "amount": 861.00, "type": "expense", "balance": 1662.51 },
          { "date": "2025-10-06", "description": "Deposit #118421972# Transfer From *****1384", "amount": 737.83, "type": "income", "balance": 2400.34 },
          { "date": "2025-10-14", "description": "Deposit #118800008# Transfer From *****0685 distribution", "amount": 10000.00, "type": "income", "balance": 12400.34 },
          { "date": "2025-10-15", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 5206.22, "type": "expense", "balance": 7194.12 },
          { "date": "2025-10-16", "description": "Deposit #118919599# Transfer From *****1927 japio reimbursement", "amount": 1800.00, "type": "income", "balance": 8994.12 },
          { "date": "2025-10-17", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 1077.03, "type": "expense", "balance": 7917.09 },
          { "date": "2025-10-17", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 853.74, "type": "expense", "balance": 7063.35 },
          { "date": "2025-10-21", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 952.10, "type": "expense", "balance": 6111.25 },
          { "date": "2025-10-28", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1809.72, "type": "expense", "balance": 4301.53 },
          { "date": "2025-10-29", "description": "ACH Withdrawal IDAHO POWER CO. 800-488-6151 - POWER BILL", "amount": 100.05, "type": "expense", "balance": 4201.48 },
          { "date": "2025-10-31", "description": "Deposit #119643069# Transfer From *****9529 malheur powder bath ligh", "amount": 549.55, "type": "income", "balance": 4751.03 },
          { "date": "2025-10-31", "description": "Deposit #119643819# Transfer From *****1384 kids reimbursement", "amount": 509.16, "type": "income", "balance": 5260.19 },
          { "date": "2025-10-31", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 1211.01, "type": "expense", "balance": 4049.18 }
        ]
      }
    ]
  },
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
  },
  "iccu_dec": {
    "statement_month": "dec",
    "statement_year": 2025,
    "accounts": [
      {
        "last_four": "1812",
        "account_type": "savings",
        "account_name": "Share Savings",
        "beginning_balance": 4272.64,
        "ending_balance": 6249.11,
        "transactions": [
          { "date": "2025-12-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 4272.64 },
          { "date": "2025-12-01", "description": "ACH Withdrawal Wealthfront EDI - EDI PYMNTS", "amount": 250.00, "type": "expense", "balance": 4022.64 },
          { "date": "2025-12-02", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 263.34, "type": "expense", "balance": 3759.30 },
          { "date": "2025-12-03", "description": "ACH Withdrawal COINBASE INC. - D3A5FF22", "amount": 29.99, "type": "expense", "balance": 3729.31 },
          { "date": "2025-12-05", "description": "Withdrawal #96638469# Ext Xfer To ******8930 Grandma", "amount": 200.00, "type": "expense", "balance": 3529.31 },
          { "date": "2025-12-09", "description": "Deposit #121608034# Transfer From *****1927 reimbusement capet clean", "amount": 469.80, "type": "income", "balance": 3999.11 },
          { "date": "2025-12-30", "description": "ACH Withdrawal Wealthfront EDI - EDI PYMNTS", "amount": 250.00, "type": "expense", "balance": 3749.11 },
          { "date": "2025-12-31", "description": "Deposit #122655731# Transfer From *****0685 Distribution", "amount": 5000.00, "type": "income", "balance": 8749.11 },
          { "date": "2025-12-31", "description": "Withdrawal #122655755# Transfer To *****1927 Contribution", "amount": 2500.00, "type": "expense", "balance": 6249.11 }
        ]
      },
      {
        "last_four": "9817",
        "account_type": "checking",
        "account_name": "Central Checking",
        "beginning_balance": 6783.19,
        "ending_balance": 3774.75,
        "transactions": [
          { "date": "2025-12-01", "description": "Beginning Balance", "amount": 0, "type": "income", "balance": 6783.19 },
          { "date": "2025-12-01", "description": "Deposit #121182566# Transfer From *****0685 distribution", "amount": 10000.00, "type": "income", "balance": 16783.19 },
          { "date": "2025-12-01", "description": "Deposit #119802286# Transfer From *****0685 ditribution", "amount": 6000.00, "type": "income", "balance": 22783.19 },
          { "date": "2025-12-02", "description": "Deposit #121254980# Transfer From *****0685 christmas cards", "amount": 78.00, "type": "income", "balance": 22861.19 },
          { "date": "2025-12-02", "description": "Deposit #121255496# Transfer From *****9529 pbc reimbursement", "amount": 240.00, "type": "income", "balance": 23101.19 },
          { "date": "2025-12-02", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 3180.31, "type": "expense", "balance": 19920.88 },
          { "date": "2025-12-02", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 2289.16, "type": "expense", "balance": 17631.72 },
          { "date": "2025-12-02", "description": "ACH Withdrawal PSN*DRY CREEK WA TER CO. LLC - WATER PAYM", "amount": 57.84, "type": "expense", "balance": 17573.88 },
          { "date": "2025-12-02", "description": "ACH Withdrawal PSN*DRY CREEK SE WER CO LLC - SEWER PAYM", "amount": 92.25, "type": "expense", "balance": 17481.63 },
          { "date": "2025-12-02", "description": "Point Of Sale Withdrawal 554402050098706 EVOLUTION INTEGRATIVE M208-917-2928 IDUS", "amount": 549.00, "type": "expense", "balance": 16932.63 },
          { "date": "2025-12-03", "description": "ACH Withdrawal CHRISTIAN HEALTH - CHMINISTRI", "amount": 861.00, "type": "expense", "balance": 16071.63 },
          { "date": "2025-12-09", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 4287.77, "type": "expense", "balance": 11783.86 },
          { "date": "2025-12-09", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 4250.94, "type": "expense", "balance": 7532.92 },
          { "date": "2025-12-10", "description": "Point Of Sale Withdrawal 295618 CASH APP*DAYNELIS HERNAOakland CAUS", "amount": 160.00, "type": "expense", "balance": 7372.92 },
          { "date": "2025-12-12", "description": "ACH Withdrawal INTERMOUNTAIN GA - PAYMENTS", "amount": 61.12, "type": "expense", "balance": 7311.80 },
          { "date": "2025-12-16", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 2292.53, "type": "expense", "balance": 5019.27 },
          { "date": "2025-12-16", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1203.21, "type": "expense", "balance": 3816.06 },
          { "date": "2025-12-22", "description": "Deposit #122262597# Transfer From *****0685 distribution", "amount": 5000.00, "type": "income", "balance": 8816.06 },
          { "date": "2025-12-23", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 1255.76, "type": "expense", "balance": 7560.30 },
          { "date": "2025-12-23", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 1943.69, "type": "expense", "balance": 5616.61 },
          { "date": "2025-12-24", "description": "Check 90", "amount": 240.00, "type": "expense", "balance": 5376.61 },
          { "date": "2025-12-29", "description": "ACH Withdrawal IDAHO POWER CO. 800-488-6151 - POWER BILL", "amount": 87.60, "type": "expense", "balance": 5289.01 },
          { "date": "2025-12-29", "description": "Withdrawal #122520033# Ext Xfer To ******3277 Transfer", "amount": 100.00, "type": "expense", "balance": 5189.01 },
          { "date": "2025-12-30", "description": "ACH Withdrawal AMEX EPAYMENT ER AM - ACH PMT", "amount": 886.85, "type": "expense", "balance": 4302.16 },
          { "date": "2025-12-30", "description": "ACH Withdrawal CITI CARD ONLINE - PAYMENT", "amount": 367.41, "type": "expense", "balance": 3934.75 },
          { "date": "2025-12-30", "description": "Point Of Sale Withdrawal 295618 CASH APP*DAYNELIS HERNAOakland CAUS", "amount": 160.00, "type": "expense", "balance": 3774.75 }
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
      allTransactions.push(...accountData.transactions);
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
