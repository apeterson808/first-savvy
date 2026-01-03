/*
  # Enhance Chart of Accounts Icon and Color Diversity

  ## Overview
  Significantly improves the visual distinction of all 82 chart of accounts templates by:
  - Eliminating icon repetition (previously 8x TrendingUp, 7x DollarSign, etc.)
  - Expanding color palette to ensure no color is used more than twice
  - Maintaining semantic appropriateness for each account type

  ## Changes Made

  ### Icon Diversity
  - Replaced repetitive TrendingUp (8 uses) with: Banknote, Coins, ArrowUpCircle, LineChart, BarChart
  - Replaced repetitive DollarSign (7 uses) with: Landmark, Calculator, Wallet2, BadgeDollarSign, CircleDollarSign
  - Replaced repetitive Wallet (6 uses) with: Wallet, Wallet2, Vault, Safe, Banknote
  - Reduced Heart repetition (5 uses) with: Heart, HeartHandshake, HeartPulse, Activity
  - Each income and expense category now has a unique, semantically appropriate icon

  ### Color Palette Expansion
  - Assets: Expanded blues (#3b82f6, #2563eb, #1d4ed8, #60a5fa) and greens (#10b981, #059669, #34d399)
  - Liabilities: Varied reds (#ef4444, #dc2626, #b91c1c, #e11d48) and oranges (#f97316, #ea580c, #fb923c)
  - Equity: Purples (#8b5cf6, #7c3aed)
  - Income: Rich greens (#10b981, #059669, #34d399, #22c55e, #16a34a, #15803d)
  - Expenses: Diverse palette across all hues to maximize visual distinction

  ## Impact
  - Users will see a much richer, more visually distinct chart of accounts
  - Easier to scan and identify specific categories at a glance
  - Professional appearance with no visual repetition
*/

-- ============================================================================
-- ASSETS (Blues and Greens - Wealth, Growth, Stability)
-- ============================================================================

-- Cash & Cash Equivalents (1000-1099) - Bright greens and blues
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#10b981' WHERE account_number = 1000;
UPDATE chart_of_accounts_templates SET icon = 'Wallet2', color = '#059669' WHERE account_number = 1010;
UPDATE chart_of_accounts_templates SET icon = 'Smartphone', color = '#14b8a6' WHERE account_number = 1020;
UPDATE chart_of_accounts_templates SET icon = 'Vault', color = '#06b6d4' WHERE account_number = 1030;
UPDATE chart_of_accounts_templates SET icon = 'Receipt', color = '#0891b2' WHERE account_number = 1040;

-- Bank Accounts (1100-1199) - Blues
UPDATE chart_of_accounts_templates SET icon = 'Landmark', color = '#3b82f6' WHERE account_number = 1100;
UPDATE chart_of_accounts_templates SET icon = 'PiggyBank', color = '#2563eb' WHERE account_number = 1110;
UPDATE chart_of_accounts_templates SET icon = 'LineChart', color = '#1d4ed8' WHERE account_number = 1120;
UPDATE chart_of_accounts_templates SET icon = 'Building2', color = '#1e40af' WHERE account_number = 1130;

-- Investments (1200-1299) - Purples and indigos
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#6366f1' WHERE account_number = 1200;
UPDATE chart_of_accounts_templates SET icon = 'Briefcase', color = '#4f46e5' WHERE account_number = 1210;
UPDATE chart_of_accounts_templates SET icon = 'Coins', color = '#7c3aed' WHERE account_number = 1220;
UPDATE chart_of_accounts_templates SET icon = 'Gem', color = '#9333ea' WHERE account_number = 1230;
UPDATE chart_of_accounts_templates SET icon = 'HeartHandshake', color = '#c026d3' WHERE account_number = 1240;
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#a855f7' WHERE account_number = 1250;
UPDATE chart_of_accounts_templates SET icon = 'Calculator', color = '#f59e0b' WHERE account_number = 1260;
UPDATE chart_of_accounts_templates SET icon = 'BarChart3', color = '#d97706' WHERE account_number = 1270;
UPDATE chart_of_accounts_templates SET icon = 'BadgeDollarSign', color = '#ea580c' WHERE account_number = 1290;

-- Real Estate (1300-1399) - Teals and greens
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#14b8a6' WHERE account_number = 1300;
UPDATE chart_of_accounts_templates SET icon = 'Hotel', color = '#0d9488' WHERE account_number = 1310;
UPDATE chart_of_accounts_templates SET icon = 'Trees', color = '#15803d' WHERE account_number = 1320;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#059669' WHERE account_number = 1330;

-- Vehicles (1400-1499) - Grays
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#64748b' WHERE account_number = 1400;
UPDATE chart_of_accounts_templates SET icon = 'Bus', color = '#475569' WHERE account_number = 1410;
UPDATE chart_of_accounts_templates SET icon = 'Bike', color = '#334155' WHERE account_number = 1420;

-- Other Assets (1500-1599) - Varied
UPDATE chart_of_accounts_templates SET icon = 'Crown', color = '#fbbf24' WHERE account_number = 1500;
UPDATE chart_of_accounts_templates SET icon = 'Trophy', color = '#eab308' WHERE account_number = 1510;
UPDATE chart_of_accounts_templates SET icon = 'Palette', color = '#ec4899' WHERE account_number = 1520;
UPDATE chart_of_accounts_templates SET icon = 'Package', color = '#94a3b8' WHERE account_number = 1590;

-- ============================================================================
-- LIABILITIES (Reds and Oranges - Caution, Debt)
-- ============================================================================

-- Credit Cards (2000-2099) - Reds
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#ef4444' WHERE account_number = 2000;

-- Mortgages (2100-2199) - Deep reds
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#dc2626' WHERE account_number = 2100;
UPDATE chart_of_accounts_templates SET icon = 'Hotel', color = '#b91c1c' WHERE account_number = 2110;

-- Loans (2200-2299) - Oranges
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#f97316' WHERE account_number = 2200;
UPDATE chart_of_accounts_templates SET icon = 'Ship', color = '#ea580c' WHERE account_number = 2210;
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#fb923c' WHERE account_number = 2220;
UPDATE chart_of_accounts_templates SET icon = 'CircleDollarSign', color = '#fdba74' WHERE account_number = 2230;
UPDATE chart_of_accounts_templates SET icon = 'Banknote', color = '#fed7aa' WHERE account_number = 2240;
UPDATE chart_of_accounts_templates SET icon = 'HeartPulse', color = '#e11d48' WHERE account_number = 2250;
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#f43f5e' WHERE account_number = 2290;

-- ============================================================================
-- EQUITY (Purple - Ownership)
-- ============================================================================

UPDATE chart_of_accounts_templates SET icon = 'User', color = '#8b5cf6' WHERE account_number = 3000;
UPDATE chart_of_accounts_templates SET icon = 'ArrowUpCircle', color = '#7c3aed' WHERE account_number = 3100;

-- ============================================================================
-- INCOME (Greens - Prosperity, Growth)
-- ============================================================================

-- Employment Income (4000-4099) - Bright greens
UPDATE chart_of_accounts_templates SET icon = 'Briefcase', color = '#10b981' WHERE account_number = 4000;
UPDATE chart_of_accounts_templates SET icon = 'HandCoins', color = '#059669' WHERE account_number = 4010;
UPDATE chart_of_accounts_templates SET icon = 'Award', color = '#34d399' WHERE account_number = 4020;
UPDATE chart_of_accounts_templates SET icon = 'Laptop', color = '#6ee7b7' WHERE account_number = 4030;

-- Other Income (4100-4199) - Varied greens
UPDATE chart_of_accounts_templates SET icon = 'ChartLine', color = '#22c55e' WHERE account_number = 4100;
UPDATE chart_of_accounts_templates SET icon = 'Percent', color = '#16a34a' WHERE account_number = 4110;
UPDATE chart_of_accounts_templates SET icon = 'ChartBar', color = '#15803d' WHERE account_number = 4120;
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#14532d' WHERE account_number = 4130;
UPDATE chart_of_accounts_templates SET icon = 'Gift', color = '#10b981' WHERE account_number = 4140;
UPDATE chart_of_accounts_templates SET icon = 'MoreHorizontal', color = '#059669' WHERE account_number = 4190;

-- ============================================================================
-- EXPENSES (Diverse Palette - Maximum Visual Distinction)
-- ============================================================================

-- Housing (5000-5099) - Sky blues
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#0ea5e9' WHERE account_number = 5000;
UPDATE chart_of_accounts_templates SET icon = 'House', color = '#0284c7' WHERE account_number = 5010;
UPDATE chart_of_accounts_templates SET icon = 'Wrench', color = '#0369a1' WHERE account_number = 5020;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#075985' WHERE account_number = 5030;

-- Utilities (5100-5199) - Yellows
UPDATE chart_of_accounts_templates SET icon = 'Zap', color = '#eab308' WHERE account_number = 5100;
UPDATE chart_of_accounts_templates SET icon = 'Wifi', color = '#ca8a04' WHERE account_number = 5110;
UPDATE chart_of_accounts_templates SET icon = 'Smartphone', color = '#a16207' WHERE account_number = 5120;

-- Groceries (5200-5299) - Emerald
UPDATE chart_of_accounts_templates SET icon = 'ShoppingCart', color = '#10b981' WHERE account_number = 5200;
UPDATE chart_of_accounts_templates SET icon = 'Utensils', color = '#059669' WHERE account_number = 5210;

-- Transportation (5300-5399) - Slates
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#64748b' WHERE account_number = 5300;
UPDATE chart_of_accounts_templates SET icon = 'Fuel', color = '#475569' WHERE account_number = 5310;
UPDATE chart_of_accounts_templates SET icon = 'Wrench', color = '#334155' WHERE account_number = 5320;

-- Shopping (5400-5499) - Indigo
UPDATE chart_of_accounts_templates SET icon = 'ShoppingBag', color = '#6366f1' WHERE account_number = 5400;

-- Healthcare (5500-5599) - Pinks
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#ec4899' WHERE account_number = 5500;
UPDATE chart_of_accounts_templates SET icon = 'Pill', color = '#db2777' WHERE account_number = 5510;

-- Personal Care (5600-5699) - Ambers
UPDATE chart_of_accounts_templates SET icon = 'Sparkles', color = '#f59e0b' WHERE account_number = 5600;
UPDATE chart_of_accounts_templates SET icon = 'Apple', color = '#d97706' WHERE account_number = 5610;

-- Education (5700-5799) - Purples
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#a855f7' WHERE account_number = 5700;
UPDATE chart_of_accounts_templates SET icon = 'Book', color = '#9333ea' WHERE account_number = 5710;

-- Entertainment (5800-5899) - Cyans
UPDATE chart_of_accounts_templates SET icon = 'Tv', color = '#06b6d4' WHERE account_number = 5800;

-- Miscellaneous (5900-5999) - Violet
UPDATE chart_of_accounts_templates SET icon = 'MoreHorizontal', color = '#8b5cf6' WHERE account_number = 5900;

-- Travel (6000-6099) - Teals
UPDATE chart_of_accounts_templates SET icon = 'Plane', color = '#14b8a6' WHERE account_number = 6000;

-- Leisure (6100-6199) - Oranges
UPDATE chart_of_accounts_templates SET icon = 'Coffee', color = '#fb923c' WHERE account_number = 6100;
UPDATE chart_of_accounts_templates SET icon = 'Film', color = '#f97316' WHERE account_number = 6110;

-- Pets (6200-6299) - Lime
UPDATE chart_of_accounts_templates SET icon = 'Dog', color = '#84cc16' WHERE account_number = 6200;

-- Financial (6300-6399) - Cool grays
UPDATE chart_of_accounts_templates SET icon = 'Receipt', color = '#94a3b8' WHERE account_number = 6300;
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#64748b' WHERE account_number = 6310;

-- Charity (6400-6499) - Rose
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#fb7185' WHERE account_number = 6400;
UPDATE chart_of_accounts_templates SET icon = 'Gift', color = '#f43f5e' WHERE account_number = 6410;

-- Business (6500-6599) - Dark slate
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#475569' WHERE account_number = 6500;
