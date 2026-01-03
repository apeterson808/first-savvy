/*
  # Add Icons and Colors to Chart of Accounts Templates

  ## Overview
  Populates icon and color fields for all 82 chart of accounts templates to provide
  a rich, visual experience for users when viewing and managing their financial categories.

  ## Changes
  - Updates all 82 template accounts with appropriate Lucide icons
  - Assigns color hex codes that are visually distinct and semantically appropriate
  - Icons match the existing ICON_MAP in BudgetCategoryList.jsx

  ## Color Scheme
  - Assets: Blues and greens (wealth, growth)
  - Liabilities: Reds and oranges (caution, debt)
  - Equity: Purple (ownership)
  - Income: Greens (prosperity, growth)
  - Expenses: Various colors by category type for easy visual distinction
*/

-- ASSETS (Blues and Greens)
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#10b981' WHERE account_number = 1000;
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#059669' WHERE account_number = 1010;
UPDATE chart_of_accounts_templates SET icon = 'Smartphone', color = '#14b8a6' WHERE account_number = 1020;
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#0d9488' WHERE account_number = 1030;
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#ef4444' WHERE account_number = 1040;
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#3b82f6' WHERE account_number = 1100;
UPDATE chart_of_accounts_templates SET icon = 'PiggyBank', color = '#2563eb' WHERE account_number = 1110;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#1d4ed8' WHERE account_number = 1120;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#1e40af' WHERE account_number = 1130;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#6366f1' WHERE account_number = 1200;
UPDATE chart_of_accounts_templates SET icon = 'Briefcase', color = '#4f46e5' WHERE account_number = 1210;
UPDATE chart_of_accounts_templates SET icon = 'PiggyBank', color = '#7c3aed' WHERE account_number = 1220;
UPDATE chart_of_accounts_templates SET icon = 'PiggyBank', color = '#9333ea' WHERE account_number = 1230;
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#ec4899' WHERE account_number = 1240;
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#8b5cf6' WHERE account_number = 1250;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#f59e0b' WHERE account_number = 1260;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#d97706' WHERE account_number = 1270;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#ea580c' WHERE account_number = 1290;
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#0891b2' WHERE account_number = 1300;
UPDATE chart_of_accounts_templates SET icon = 'Hotel', color = '#0e7490' WHERE account_number = 1310;
UPDATE chart_of_accounts_templates SET icon = 'Trees', color = '#15803d' WHERE account_number = 1320;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#0d9488' WHERE account_number = 1330;
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#64748b' WHERE account_number = 1400;
UPDATE chart_of_accounts_templates SET icon = 'Bus', color = '#475569' WHERE account_number = 1410;
UPDATE chart_of_accounts_templates SET icon = 'Bike', color = '#334155' WHERE account_number = 1420;
UPDATE chart_of_accounts_templates SET icon = 'Crown', color = '#f59e0b' WHERE account_number = 1500;
UPDATE chart_of_accounts_templates SET icon = 'Trophy', color = '#eab308' WHERE account_number = 1510;
UPDATE chart_of_accounts_templates SET icon = 'Palette', color = '#ec4899' WHERE account_number = 1520;
UPDATE chart_of_accounts_templates SET icon = 'Package', color = '#94a3b8' WHERE account_number = 1590;

-- LIABILITIES (Reds and Oranges)
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#ef4444' WHERE account_number = 2000;
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#dc2626' WHERE account_number = 2100;
UPDATE chart_of_accounts_templates SET icon = 'Hotel', color = '#b91c1c' WHERE account_number = 2110;
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#f97316' WHERE account_number = 2200;
UPDATE chart_of_accounts_templates SET icon = 'Bus', color = '#ea580c' WHERE account_number = 2210;
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#fb923c' WHERE account_number = 2220;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#f59e0b' WHERE account_number = 2230;
UPDATE chart_of_accounts_templates SET icon = 'Wallet', color = '#f97316' WHERE account_number = 2240;
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#dc2626' WHERE account_number = 2250;
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#e11d48' WHERE account_number = 2290;

-- EQUITY (Purple)
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#8b5cf6' WHERE account_number = 3000;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#7c3aed' WHERE account_number = 3100;

-- INCOME (Greens)
UPDATE chart_of_accounts_templates SET icon = 'Briefcase', color = '#10b981' WHERE account_number = 4000;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#059669' WHERE account_number = 4010;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#34d399' WHERE account_number = 4020;
UPDATE chart_of_accounts_templates SET icon = 'Laptop', color = '#10b981' WHERE account_number = 4030;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#22c55e' WHERE account_number = 4100;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#16a34a' WHERE account_number = 4110;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp', color = '#15803d' WHERE account_number = 4120;
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#059669' WHERE account_number = 4130;
UPDATE chart_of_accounts_templates SET icon = 'Gift', color = '#14b8a6' WHERE account_number = 4140;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#0d9488' WHERE account_number = 4190;

-- EXPENSES (Various colors by category)
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#0ea5e9' WHERE account_number = 5000;
UPDATE chart_of_accounts_templates SET icon = 'Home', color = '#0284c7' WHERE account_number = 5010;
UPDATE chart_of_accounts_templates SET icon = 'Wrench', color = '#0369a1' WHERE account_number = 5020;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#0c4a6e' WHERE account_number = 5030;
UPDATE chart_of_accounts_templates SET icon = 'Zap', color = '#eab308' WHERE account_number = 5100;
UPDATE chart_of_accounts_templates SET icon = 'Wifi', color = '#ca8a04' WHERE account_number = 5110;
UPDATE chart_of_accounts_templates SET icon = 'Smartphone', color = '#a16207' WHERE account_number = 5120;
UPDATE chart_of_accounts_templates SET icon = 'ShoppingCart', color = '#16a34a' WHERE account_number = 5200;
UPDATE chart_of_accounts_templates SET icon = 'Utensils', color = '#f97316' WHERE account_number = 5210;
UPDATE chart_of_accounts_templates SET icon = 'Car', color = '#64748b' WHERE account_number = 5300;
UPDATE chart_of_accounts_templates SET icon = 'Fuel', color = '#475569' WHERE account_number = 5310;
UPDATE chart_of_accounts_templates SET icon = 'Wrench', color = '#334155' WHERE account_number = 5320;
UPDATE chart_of_accounts_templates SET icon = 'ShoppingBag', color = '#6366f1' WHERE account_number = 5400;
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#ec4899' WHERE account_number = 5500;
UPDATE chart_of_accounts_templates SET icon = 'Pill', color = '#db2777' WHERE account_number = 5510;
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#f59e0b' WHERE account_number = 5600;
UPDATE chart_of_accounts_templates SET icon = 'Apple', color = '#d97706' WHERE account_number = 5610;
UPDATE chart_of_accounts_templates SET icon = 'GraduationCap', color = '#8b5cf6' WHERE account_number = 5700;
UPDATE chart_of_accounts_templates SET icon = 'Book', color = '#7c3aed' WHERE account_number = 5710;
UPDATE chart_of_accounts_templates SET icon = 'Tv', color = '#06b6d4' WHERE account_number = 5800;
UPDATE chart_of_accounts_templates SET icon = 'ShoppingBag', color = '#a855f7' WHERE account_number = 5900;
UPDATE chart_of_accounts_templates SET icon = 'Plane', color = '#14b8a6' WHERE account_number = 6000;
UPDATE chart_of_accounts_templates SET icon = 'Coffee', color = '#f59e0b' WHERE account_number = 6100;
UPDATE chart_of_accounts_templates SET icon = 'Film', color = '#f97316' WHERE account_number = 6110;
UPDATE chart_of_accounts_templates SET icon = 'Dog', color = '#84cc16' WHERE account_number = 6200;
UPDATE chart_of_accounts_templates SET icon = 'DollarSign', color = '#94a3b8' WHERE account_number = 6300;
UPDATE chart_of_accounts_templates SET icon = 'CreditCard', color = '#64748b' WHERE account_number = 6310;
UPDATE chart_of_accounts_templates SET icon = 'Heart', color = '#ec4899' WHERE account_number = 6400;
UPDATE chart_of_accounts_templates SET icon = 'Gift', color = '#f43f5e' WHERE account_number = 6410;
UPDATE chart_of_accounts_templates SET icon = 'Building', color = '#475569' WHERE account_number = 6500;
