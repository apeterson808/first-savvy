/*
  # Improve Icon Variety and Contextual Relevance

  1. Changes
    - Replace duplicate "Gift" icon for Donations with unique icon
    - Update icons to be more contextually specific and visually distinct
    
  2. Icon Updates
    - Donations: Gift → CircleDollarSign (monetary giving)
    - Healthcare: Heart → Activity (health monitoring/vitals)
    - HOA Fees: Building → Landmark (community building)
    - Other Income: MoreHorizontal → Wallet (general money)
    - Home Maintenance: Wrench → Hammer (repairs/construction)
    - Utilities: Zap → Droplets (water/utilities)
    - Education: GraduationCap → BookOpen (learning/study)
    - Lifestyle: Coffee → Sparkles (enjoyment/leisure)
    - Financial Fees: Receipt → FileText (documents/statements)
    - Subscriptions: Tv → Radio (media/services)
    - Side Income: Laptop → Briefcase (professional work)
    - Bonus: HandCoins → TrendingUp (growth/gains)
    - Interest: ChartLine → PiggyBank (savings)
    - Dividends: Percent → TrendingUp (returns)
    - Investment Income: ChartBar → LineChart (market tracking)
*/

UPDATE chart_of_accounts_templates SET icon = 'CircleDollarSign' WHERE account_number = 6410;
UPDATE chart_of_accounts_templates SET icon = 'Activity' WHERE account_number = 5500;
UPDATE chart_of_accounts_templates SET icon = 'Landmark' WHERE account_number = 5030;
UPDATE chart_of_accounts_templates SET icon = 'Wallet' WHERE account_number = 4190;
UPDATE chart_of_accounts_templates SET icon = 'Hammer' WHERE account_number = 5020;
UPDATE chart_of_accounts_templates SET icon = 'Droplets' WHERE account_number = 5100;
UPDATE chart_of_accounts_templates SET icon = 'BookOpen' WHERE account_number = 5700;
UPDATE chart_of_accounts_templates SET icon = 'Sparkles' WHERE account_number = 6100;
UPDATE chart_of_accounts_templates SET icon = 'FileText' WHERE account_number = 6300;
UPDATE chart_of_accounts_templates SET icon = 'Radio' WHERE account_number = 5800;
UPDATE chart_of_accounts_templates SET icon = 'Briefcase' WHERE account_number = 4030;
UPDATE chart_of_accounts_templates SET icon = 'TrendingUp' WHERE account_number = 4010;
UPDATE chart_of_accounts_templates SET icon = 'PiggyBank' WHERE account_number = 4100;
UPDATE chart_of_accounts_templates SET icon = 'Coins' WHERE account_number = 4110;
UPDATE chart_of_accounts_templates SET icon = 'LineChart' WHERE account_number = 4120;