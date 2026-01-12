# QuickBooks vs Savvy Architecture Comparison

## Executive Summary

Savvy has built a **solid double-entry accounting foundation** but is currently a **transaction categorization tool, not full accounting software**. To match QuickBooks, we need to add business-critical features like invoicing, payables, and financial reporting.

## Current State: What Works Well ✓

### 1. Core Accounting Engine (EXCELLENT)
- **True Double-Entry Bookkeeping**: Every transaction creates balanced debit/credit journal entries
- **Single Source of Truth**: `journal_entry_lines` is authoritative for all posted transactions
- **Chart of Accounts**: Professional 81-account template with 5-class hierarchy (Asset, Liability, Equity, Income, Expense)
- **Automatic Journal Entry Creation**: Triggers auto-create journal entries when transactions are categorized
- **Balance Integrity**: Account balances calculated from journal entries, enforced at database level
- **Multi-User Support**: Profile-based multi-tenancy with role-based access control

### 2. Data Flow Architecture (CORRECT)
```
Bank Import → transactions (pending) → User Categorizes → Auto Journal Entry →
Balance Update → Account Register (reads journal_entry_lines only)
```

### 3. Advanced Features Present
- Split transactions across multiple categories
- Opening balance entries for new accounts
- Transfer tracking between accounts
- Transaction deduplication
- Contact/vendor basic tracking
- Amazon transaction enrichment
- Reconciliation infrastructure (partial)

---

## Critical Gaps: What's Missing ⚠️

### PHASE 1: BUSINESS BLOCKING (Must Implement Now)

#### 1. Invoices & Accounts Receivable
**Status**: Not implemented
**Impact**: Service businesses cannot track revenue or customer payments

**What's Needed**:
```sql
-- New tables required
CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  customer_id uuid REFERENCES contacts(id),
  invoice_number text UNIQUE,
  invoice_date date,
  due_date date,
  status text, -- draft, sent, paid, overdue, void
  subtotal numeric,
  tax_amount numeric,
  total_amount numeric,
  ar_account_id uuid REFERENCES user_chart_of_accounts(id),
  journal_entry_id uuid REFERENCES journal_entries(id)
);

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id),
  description text,
  quantity numeric,
  unit_price numeric,
  income_account_id uuid REFERENCES user_chart_of_accounts(id),
  tax_rate_id uuid REFERENCES tax_rates(id),
  line_total numeric
);

CREATE TABLE invoice_payments (
  id uuid PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id),
  payment_date date,
  amount numeric,
  payment_account_id uuid REFERENCES user_chart_of_accounts(id),
  journal_entry_id uuid REFERENCES journal_entries(id)
);
```

**Journal Entries Auto-Created**:
- Invoice creation: `DR Accounts Receivable | CR Income Account(s)`
- Payment received: `DR Bank Account | CR Accounts Receivable`
- Write-off: `DR Bad Debt Expense | CR Accounts Receivable`

**Reports Enabled**:
- Customer aging (30/60/90 days)
- Revenue by customer
- Unpaid invoices
- Sales by income category

---

#### 2. Bills & Accounts Payable
**Status**: Partial (bills table exists but no AP integration)
**Impact**: Cannot track vendor obligations or expense accruals

**What's Needed**:
```sql
-- Restructure existing bills table
CREATE TABLE bills (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  vendor_id uuid REFERENCES contacts(id),
  bill_number text,
  bill_date date,
  due_date date,
  status text, -- unpaid, paid, overdue, scheduled
  subtotal numeric,
  tax_amount numeric,
  total_amount numeric,
  ap_account_id uuid REFERENCES user_chart_of_accounts(id),
  journal_entry_id uuid REFERENCES journal_entries(id)
);

CREATE TABLE bill_items (
  id uuid PRIMARY KEY,
  bill_id uuid REFERENCES bills(id),
  description text,
  quantity numeric,
  unit_price numeric,
  expense_account_id uuid REFERENCES user_chart_of_accounts(id),
  tax_rate_id uuid REFERENCES tax_rates(id),
  line_total numeric
);

CREATE TABLE bill_payments (
  id uuid PRIMARY KEY,
  bill_id uuid REFERENCES bills(id),
  payment_date date,
  amount numeric,
  payment_account_id uuid REFERENCES user_chart_of_accounts(id),
  journal_entry_id uuid REFERENCES journal_entries(id)
);
```

**Journal Entries Auto-Created**:
- Bill entry: `DR Expense Account(s) | CR Accounts Payable`
- Payment made: `DR Accounts Payable | CR Bank Account`

**Reports Enabled**:
- Vendor aging
- Unpaid bills
- Expenses by vendor
- Cash requirements forecast

---

#### 3. Sales Tax Infrastructure
**Status**: Not implemented
**Impact**: Legal compliance nightmare, manual tax calculation

**What's Needed**:
```sql
CREATE TABLE tax_rates (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  name text, -- "CA Sales Tax", "NYC Sales Tax"
  rate numeric, -- 0.0825 (8.25%)
  tax_type text, -- sales, use, vat, gst
  jurisdiction text, -- state, county, city
  is_compound boolean DEFAULT false,
  is_active boolean DEFAULT true
);

CREATE TABLE tax_codes (
  id uuid PRIMARY KEY,
  code text, -- "TAXABLE", "EXEMPT", "FOOD"
  description text,
  default_rate_id uuid REFERENCES tax_rates(id)
);

-- Add to invoice_items and bill_items
ALTER TABLE invoice_items ADD COLUMN tax_code_id uuid REFERENCES tax_codes(id);
ALTER TABLE bill_items ADD COLUMN tax_code_id uuid REFERENCES tax_codes(id);

-- Tax liability account in chart of accounts
-- Auto-provision: 2400 - Sales Tax Payable
```

**Journal Entries Auto-Created**:
- Invoice with tax: `DR AR | CR Income + CR Sales Tax Payable`
- Tax payment: `DR Sales Tax Payable | CR Bank Account`

**Reports Enabled**:
- Sales tax collected
- Sales tax owed by jurisdiction
- Tax filing reports

---

#### 4. Financial Statement Reports
**Status**: Not implemented
**Impact**: Cannot provide financial statements to banks, investors, or tax authorities

**What's Needed**:

**A. Balance Sheet**
```typescript
// Generate from chart of accounts + current balances
Assets (debit normal accounts)
- Current Assets (cash, AR, inventory)
- Fixed Assets (equipment, vehicles, buildings)
- Other Assets

Liabilities (credit normal accounts)
- Current Liabilities (AP, credit cards, short-term loans)
- Long-Term Liabilities (mortgages, long-term loans)

Equity (credit normal accounts)
- Owner's Equity
- Retained Earnings
- Current Year Profit/Loss

Formula: Assets = Liabilities + Equity (must balance)
```

**B. Profit & Loss (Income Statement)**
```typescript
// Generate from income/expense accounts for date range
Income
- Revenue streams (all 4000-4999 accounts with activity)
- Total Income

Expenses
- Operating expenses (all 5000-5999 accounts with activity)
- Total Expenses

Net Income = Total Income - Total Expenses
```

**C. Cash Flow Statement**
```typescript
// Generate from all bank accounts for date range
Operating Activities
- Cash from customers
- Cash to suppliers
- Cash for operating expenses

Investing Activities
- Purchase/sale of assets

Financing Activities
- Loans received/repaid
- Owner contributions/draws

Net Cash Flow = Operating + Investing + Financing
```

**D. Trial Balance**
```typescript
// Validate double-entry integrity
For each account:
- Beginning balance
- Total debits in period
- Total credits in period
- Ending balance

Sum of all debit balances = Sum of all credit balances (must balance)
```

---

### PHASE 2: COMPETITIVE NECESSITY (Next Quarter)

#### 5. Bank Reconciliation (Complete Implementation)
**Status**: Partial infrastructure exists (cleared_date field), no UI

**What's Needed**:
```sql
CREATE TABLE bank_reconciliations (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  account_id uuid REFERENCES user_chart_of_accounts(id),
  reconciliation_date date,
  statement_balance numeric,
  gl_balance numeric,
  difference numeric,
  status text, -- in_progress, completed
  reconciled_by uuid REFERENCES auth.users(id),
  completed_at timestamptz
);

CREATE TABLE reconciliation_items (
  id uuid PRIMARY KEY,
  reconciliation_id uuid REFERENCES bank_reconciliations(id),
  journal_entry_line_id uuid REFERENCES journal_entry_lines(id),
  cleared boolean DEFAULT false,
  cleared_date date,
  statement_amount numeric
);
```

**Features Required**:
- Match bank transactions to journal entries
- Mark items as cleared
- Track outstanding checks/deposits
- Generate reconciliation report
- Identify discrepancies

---

#### 6. Payroll Foundation
**Status**: Not implemented
**Impact**: Cannot track employee costs, payroll taxes

**What's Needed**:
```sql
CREATE TABLE employees (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  first_name text,
  last_name text,
  employee_number text,
  ssn_encrypted text, -- encrypted
  employment_type text, -- w2, 1099, contractor
  pay_rate numeric,
  pay_frequency text, -- hourly, salary
  hire_date date,
  termination_date date,
  is_active boolean DEFAULT true
);

CREATE TABLE payroll_runs (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  pay_period_start date,
  pay_period_end date,
  pay_date date,
  status text, -- draft, processed, paid
  journal_entry_id uuid REFERENCES journal_entries(id)
);

CREATE TABLE payroll_items (
  id uuid PRIMARY KEY,
  payroll_run_id uuid REFERENCES payroll_runs(id),
  employee_id uuid REFERENCES employees(id),
  gross_pay numeric,
  federal_tax numeric,
  state_tax numeric,
  fica_employee numeric,
  fica_employer numeric,
  medicare_employee numeric,
  medicare_employer numeric,
  net_pay numeric
);

-- Auto-provision chart accounts:
-- 6000 - Salaries & Wages Expense
-- 6100 - Payroll Tax Expense
-- 2100 - Federal Payroll Tax Payable
-- 2110 - State Payroll Tax Payable
-- 2120 - FICA Payable
-- 2130 - Medicare Payable
```

**Journal Entries Auto-Created**:
- Payroll run:
  ```
  DR Salaries Expense (gross)
  DR Payroll Tax Expense (employer share)
  CR Federal Tax Payable
  CR State Tax Payable
  CR FICA Payable
  CR Bank Account (net pay)
  ```

**Reports Enabled**:
- Payroll register
- W-2 annual summary
- 1099 contractor payments
- Payroll tax liability
- YTD payroll by employee

---

### PHASE 3: FEATURE PARITY (3-6 Months)

#### 7. Project/Job Costing
Add project dimension to track profitability by job/client

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  name text,
  client_id uuid REFERENCES contacts(id),
  status text, -- active, completed, on_hold
  budget numeric,
  start_date date,
  end_date date
);

-- Add project_id to all financial tables
ALTER TABLE journal_entry_lines ADD COLUMN project_id uuid REFERENCES projects(id);
ALTER TABLE transactions ADD COLUMN project_id uuid REFERENCES projects(id);
ALTER TABLE invoice_items ADD COLUMN project_id uuid REFERENCES projects(id);
```

**Reports Enabled**:
- Project P&L
- Budget vs. actual by project
- Project profitability
- Time/expense allocation by project

---

#### 8. Inventory Management
Track product quantities and COGS

```sql
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  sku text,
  name text,
  description text,
  unit_cost numeric,
  quantity_on_hand numeric,
  inventory_account_id uuid REFERENCES user_chart_of_accounts(id),
  cogs_account_id uuid REFERENCES user_chart_of_accounts(id)
);

CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY,
  item_id uuid REFERENCES inventory_items(id),
  transaction_date date,
  transaction_type text, -- purchase, sale, adjustment
  quantity numeric,
  unit_cost numeric,
  journal_entry_id uuid REFERENCES journal_entries(id)
);

-- Auto-provision accounts:
-- 1300 - Inventory Asset
-- 5000 - Cost of Goods Sold
```

**Journal Entries Auto-Created**:
- Purchase: `DR Inventory | CR AP or Bank`
- Sale: `DR COGS | CR Inventory` (at cost)
- Revenue: `DR AR or Bank | CR Sales Revenue` (at price)

---

#### 9. Recurring Transaction Automation
Current bills table tracks recurring, but doesn't auto-create

**What's Needed**:
```sql
CREATE TABLE recurring_transactions (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  name text,
  frequency text, -- daily, weekly, monthly, yearly
  next_occurrence date,
  end_date date,
  is_active boolean DEFAULT true,
  template_data jsonb -- stores transaction/JE template
);

-- Scheduled job runs daily:
-- - Check for due recurring transactions
-- - Auto-create transactions/journal entries
-- - Update next_occurrence date
```

---

#### 10. Multi-Currency Support
Currently stores currency but doesn't process

**What's Needed**:
```sql
CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY,
  from_currency text,
  to_currency text,
  rate numeric,
  effective_date date,
  UNIQUE(from_currency, to_currency, effective_date)
);

-- Add to all tables
ALTER TABLE journal_entry_lines ADD COLUMN currency text DEFAULT 'USD';
ALTER TABLE journal_entry_lines ADD COLUMN exchange_rate numeric DEFAULT 1.0;
ALTER TABLE journal_entry_lines ADD COLUMN base_currency_amount numeric;

-- Auto-provision accounts:
-- 8000 - Foreign Exchange Gain
-- 8100 - Foreign Exchange Loss
```

**Journal Entries Auto-Created**:
- Transaction in foreign currency creates FX gain/loss entry
- Automatic revaluation at period end

---

### PHASE 4: ADVANCED FEATURES (Nice-to-Have)

#### 11. Departments/Classes/Locations
Add dimensional tracking for segment reporting

```sql
CREATE TABLE departments (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  name text,
  parent_id uuid REFERENCES departments(id)
);

ALTER TABLE journal_entry_lines ADD COLUMN department_id uuid REFERENCES departments(id);
```

#### 12. Time Tracking
Track billable hours for professional services

```sql
CREATE TABLE time_entries (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  employee_id uuid REFERENCES employees(id),
  project_id uuid REFERENCES projects(id),
  entry_date date,
  hours numeric,
  billable_rate numeric,
  description text
);
```

---

## Implementation Priority Matrix

| Feature | Business Impact | Technical Complexity | Priority |
|---------|----------------|---------------------|----------|
| Invoices/AR | CRITICAL | Medium | P0 - Week 1 |
| Bills/AP | CRITICAL | Medium | P0 - Week 2 |
| Sales Tax | CRITICAL | Low | P0 - Week 3 |
| Financial Reports | CRITICAL | Medium | P1 - Week 4 |
| Bank Reconciliation | HIGH | Low | P1 - Week 5 |
| Payroll Foundation | HIGH | High | P2 - Month 2 |
| Project Costing | MEDIUM | Medium | P3 - Month 3 |
| Inventory | MEDIUM | High | P3 - Month 4 |
| Recurring Auto | MEDIUM | Low | P3 - Month 3 |
| Multi-Currency | LOW | High | P4 - Later |
| Departments | LOW | Low | P4 - Later |
| Time Tracking | LOW | Medium | P4 - Later |

---

## Key Architectural Strengths to Preserve

1. **Double-Entry Enforcement**: Keep journal_entry_lines as single source of truth ✓
2. **Event-Driven Architecture**: Keep auto-triggers for journal entry creation ✓
3. **Profile-Based Multi-Tenancy**: Preserve for household/team features ✓
4. **Balance Calculation**: Keep database-driven balance updates ✓
5. **Pagination & Performance**: Maintain optimized queries with running balance ✓

---

## Migration Strategy

### Week 1-2: Foundation
1. Create invoices, invoice_items, invoice_payments tables
2. Create bills, bill_items, bill_payments tables (restructure existing)
3. Auto-provision AR/AP accounts in chart of accounts
4. Build journal entry triggers for invoice/bill lifecycle

### Week 3-4: Tax & Reporting
5. Create tax_rates, tax_codes tables
6. Add tax fields to invoice_items, bill_items
7. Build Balance Sheet report
8. Build P&L report
9. Build Cash Flow report
10. Build Trial Balance report

### Week 5-6: Reconciliation & UX
11. Complete bank reconciliation tables
12. Build reconciliation matching UI
13. Build outstanding items report
14. Create invoice entry UI
15. Create bill entry UI

### Month 2: Payroll
16. Create employees, payroll_runs, payroll_items tables
17. Auto-provision payroll accounts
18. Build payroll entry form
19. Build payroll reports

---

## Current State Assessment

**Overall Grade: B (Good Foundation, Missing Business Features)**

| Component | Grade | Notes |
|-----------|-------|-------|
| Double-Entry Engine | A | Properly implemented, enforced at DB level |
| Chart of Accounts | A | Professional structure, good hierarchy |
| Journal Entry System | A | Auto-creation works correctly |
| Transaction Processing | B+ | Pending/posted separation works well |
| Invoicing/AR | F | Not implemented |
| Bills/AP | D | Partial (bills table exists, no AP integration) |
| Sales Tax | F | Not implemented |
| Financial Reports | F | Not implemented |
| Bank Reconciliation | D | Infrastructure exists, no UI/workflow |
| Payroll | F | Not implemented |
| Multi-Currency | F | Stored but not processed |
| Project Costing | F | Not implemented |
| Inventory | F | Not implemented |

**Verdict**: Excellent accounting engine foundation, but currently a personal finance/expense categorization tool rather than business accounting software. Needs AR/AP/Reporting to compete with QuickBooks.

---

## Next Steps

1. **Immediate**: Implement Phase 1 (Invoices, Bills, Tax, Reports) - 4-6 weeks
2. **Short-term**: Implement Phase 2 (Reconciliation, Payroll) - 6-8 weeks
3. **Medium-term**: Implement Phase 3 (Projects, Inventory, Automation) - 3-4 months
4. **Long-term**: Implement Phase 4 (Advanced features) - 6+ months

After Phase 1 completion, Savvy will be viable for:
- Freelancers and consultants (invoicing)
- Small service businesses (AR tracking)
- Expense management (AP tracking)
- Tax compliance (sales tax)
- Financial reporting (P&L, Balance Sheet)

After Phase 2 completion, Savvy will be competitive with QuickBooks for small businesses under $1M revenue.
