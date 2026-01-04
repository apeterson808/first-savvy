import { supabase } from './supabaseClient';

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

  if (institution.name.toLowerCase().includes('idaho central')) {
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

  throw new Error('Only ICCU is supported in simulation mode');
}

export async function getInstitutionAccounts(institutionId, profileId = null) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const institution = await getInstitutionById(institutionId);

  if (!institution || !institution.name.toLowerCase().includes('idaho central')) {
    return [];
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !profileId) {
    return [];
  }

  const accountsByLast4 = {};

  Object.values(ICCU_SIMULATION_DATA).forEach(monthData => {
    monthData.accounts.forEach(account => {
      if (!accountsByLast4[account.last_four]) {
        accountsByLast4[account.last_four] = {
          id: `sim_${account.last_four}`,
          name: account.account_name,
          type: account.account_type,
          last_four: account.last_four,
          current_balance: account.ending_balance,
          institution_name: institution.name,
          institution_id: institutionId,
          transaction_count: 0,
          date_range: { start: null, end: null }
        };
      }
    });
  });

  Object.values(ICCU_SIMULATION_DATA).forEach(monthData => {
    monthData.accounts.forEach(account => {
      const acc = accountsByLast4[account.last_four];
      if (acc) {
        acc.transaction_count += account.transactions.length;
        acc.current_balance = account.ending_balance;

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

  const last4 = accountId.replace('sim_', '');
  const allTransactions = [];

  Object.values(ICCU_SIMULATION_DATA).forEach(monthData => {
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
