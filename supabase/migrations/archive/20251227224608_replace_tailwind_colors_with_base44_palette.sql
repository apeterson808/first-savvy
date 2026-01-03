/*
  # Replace Tailwind Colors with BASE44 Color Palette
  
  ## Overview
  Replaces all Tailwind color codes in chart_of_accounts_templates with the BASE44_COLORS palette
  to ensure consistent branding across the entire application.
  
  ## BASE44 Color Palette
  - softGreen: #AACC96 (wealth, growth, prosperity)
  - darkForestGreen: #25533F (stability, deep value)
  - peach: #F4BEAE (warm, approachable)
  - skyBlue: #52A5CE (trust, clarity)
  - pink: #FF7BAC (vibrant, energetic)
  - brown: #876029 (grounded, reliable)
  - burgundy: #6D1F42 (serious, important)
  - lavender: #D3B6D3 (calm, thoughtful)
  - yellow: #EFCE7B (optimistic, attention)
  - lightBlue: #B8CEE8 (peace, stability)
  - orange: #EF6F3C (energy, action)
  - olive: #AFAB23 (natural, steady)
  
  ## Color Assignment Strategy
  - Assets: softGreen, skyBlue, lightBlue (prosperity and stability)
  - Liabilities: burgundy, orange, brown (caution and debt)
  - Equity: darkForestGreen, olive (ownership and foundation)
  - Income: softGreen, yellow (prosperity and positivity)
  - Expenses: Distributed across all remaining colors for visual diversity
  
  ## Changes Made
  Updates all 82 account templates with BASE44 colors while maintaining semantic appropriateness.
*/

-- ============================================================================
-- ASSETS (Prosperity colors: softGreen, skyBlue, lightBlue, peach)
-- ============================================================================

-- Cash & Cash Equivalents (1000-1099) - Bright, liquid wealth
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 1000;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 1010;  -- skyBlue
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 1020;  -- lightBlue
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 1030;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 1040;  -- skyBlue

-- Bank Accounts (1100-1199) - Trust and stability
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 1100;  -- skyBlue
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 1110;  -- lightBlue
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 1120;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 1130;  -- skyBlue

-- Investments (1200-1299) - Growth and prosperity
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 1200;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 1210;  -- darkForestGreen
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 1220;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#D3B6D3' WHERE account_number = 1230;  -- lavender
UPDATE chart_of_accounts_templates SET color = '#F4BEAE' WHERE account_number = 1240;  -- peach
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 1250;  -- lightBlue
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 1260;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 1270;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 1290;  -- skyBlue

-- Real Estate (1300-1399) - Solid, stable assets
UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 1300;  -- darkForestGreen
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 1310;  -- brown
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 1320;  -- olive
UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 1330;  -- darkForestGreen

-- Vehicles (1400-1499) - Practical assets
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 1400;  -- brown
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 1410;  -- olive
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 1420;  -- brown

-- Other Assets (1500-1599) - Varied
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 1500;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 1510;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#FF7BAC' WHERE account_number = 1520;  -- pink
UPDATE chart_of_accounts_templates SET color = '#D3B6D3' WHERE account_number = 1590;  -- lavender

-- ============================================================================
-- LIABILITIES (Caution colors: burgundy, orange, brown)
-- ============================================================================

-- Credit Cards (2000-2099)
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 2000;  -- burgundy

-- Mortgages (2100-2199)
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 2100;  -- burgundy
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 2110;  -- brown

-- Loans (2200-2299)
UPDATE chart_of_accounts_templates SET color = '#EF6F3C' WHERE account_number = 2200;  -- orange
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 2210;  -- brown
UPDATE chart_of_accounts_templates SET color = '#EF6F3C' WHERE account_number = 2220;  -- orange
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 2230;  -- brown
UPDATE chart_of_accounts_templates SET color = '#EF6F3C' WHERE account_number = 2240;  -- orange
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 2250;  -- burgundy
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 2290;  -- burgundy

-- ============================================================================
-- EQUITY (Foundation colors: darkForestGreen, olive)
-- ============================================================================

UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 3000;  -- darkForestGreen
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 3100;  -- olive

-- ============================================================================
-- INCOME (Prosperity colors: softGreen, yellow)
-- ============================================================================

-- Employment Income (4000-4099)
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 4000;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 4010;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 4020;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 4030;  -- yellow

-- Other Income (4100-4199)
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 4100;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 4110;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 4120;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 4130;  -- darkForestGreen
UPDATE chart_of_accounts_templates SET color = '#F4BEAE' WHERE account_number = 4140;  -- peach
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 4190;  -- softGreen

-- ============================================================================
-- EXPENSES (Full palette for maximum diversity)
-- ============================================================================

-- Housing (5000-5099)
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 5000;  -- skyBlue
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 5010;  -- lightBlue
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 5020;  -- skyBlue
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 5030;  -- lightBlue

-- Utilities (5100-5199)
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 5100;  -- yellow
UPDATE chart_of_accounts_templates SET color = '#EF6F3C' WHERE account_number = 5110;  -- orange
UPDATE chart_of_accounts_templates SET color = '#EFCE7B' WHERE account_number = 5120;  -- yellow

-- Groceries (5200-5299)
UPDATE chart_of_accounts_templates SET color = '#AACC96' WHERE account_number = 5200;  -- softGreen
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 5210;  -- olive

-- Transportation (5300-5399)
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 5300;  -- brown
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 5310;  -- olive
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 5320;  -- brown

-- Shopping (5400-5499)
UPDATE chart_of_accounts_templates SET color = '#FF7BAC' WHERE account_number = 5400;  -- pink

-- Healthcare (5500-5599)
UPDATE chart_of_accounts_templates SET color = '#FF7BAC' WHERE account_number = 5500;  -- pink
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 5510;  -- burgundy

-- Personal Care (5600-5699)
UPDATE chart_of_accounts_templates SET color = '#F4BEAE' WHERE account_number = 5600;  -- peach
UPDATE chart_of_accounts_templates SET color = '#FF7BAC' WHERE account_number = 5610;  -- pink

-- Education (5700-5799)
UPDATE chart_of_accounts_templates SET color = '#D3B6D3' WHERE account_number = 5700;  -- lavender
UPDATE chart_of_accounts_templates SET color = '#B8CEE8' WHERE account_number = 5710;  -- lightBlue

-- Entertainment (5800-5899)
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 5800;  -- skyBlue

-- Miscellaneous (5900-5999)
UPDATE chart_of_accounts_templates SET color = '#D3B6D3' WHERE account_number = 5900;  -- lavender

-- Travel (6000-6099)
UPDATE chart_of_accounts_templates SET color = '#52A5CE' WHERE account_number = 6000;  -- skyBlue

-- Leisure (6100-6199)
UPDATE chart_of_accounts_templates SET color = '#F4BEAE' WHERE account_number = 6100;  -- peach
UPDATE chart_of_accounts_templates SET color = '#EF6F3C' WHERE account_number = 6110;  -- orange

-- Pets (6200-6299)
UPDATE chart_of_accounts_templates SET color = '#AFAB23' WHERE account_number = 6200;  -- olive

-- Financial (6300-6399)
UPDATE chart_of_accounts_templates SET color = '#876029' WHERE account_number = 6300;  -- brown
UPDATE chart_of_accounts_templates SET color = '#6D1F42' WHERE account_number = 6310;  -- burgundy

-- Charity (6400-6499)
UPDATE chart_of_accounts_templates SET color = '#F4BEAE' WHERE account_number = 6400;  -- peach
UPDATE chart_of_accounts_templates SET color = '#FF7BAC' WHERE account_number = 6410;  -- pink

-- Business (6500-6599)
UPDATE chart_of_accounts_templates SET color = '#25533F' WHERE account_number = 6500;  -- darkForestGreen
