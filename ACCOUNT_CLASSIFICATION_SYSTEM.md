# Account Classification System

## Overview

The account classification system provides a three-tier hierarchy for organizing all account types across your financial management app:

- **Class** (Top level): asset, liability, income, expense, equity
- **Type** (Mid level): Groups related categories (e.g., "bank accounts", "credit card", "investments")
- **Category** (Specific): Detailed classification (e.g., "checking", "savings", "401k")

## Key Features

### 🔒 Protected Master Data
- System templates stored in `account_classification_templates` table
- 89 predefined classifications covering all common account types
- Protected from accidental user modifications
- Only admins can update through migrations

### 👤 Per-User Customization
- Each user gets their own copy in `account_classifications` table
- Users can customize display names without affecting others
- Users can add custom categories under existing types
- Class and type fields are locked (not user-editable)

### 🚀 Automatic Provisioning
- New users automatically receive all 89 classifications on signup
- Database trigger handles provisioning transparently
- No manual setup required

### 📊 Data Structure

```
Class (locked) → Type (locked) → Category → Display Name (editable)
     ↓                ↓              ↓              ↓
   asset      →  bank accounts →  checking  →  "Checking Account"
```

## Database Tables

### account_classification_templates
**Purpose**: Protected system-wide master list (no user access)

**Key Columns**:
- `class`: asset | liability | income | expense | equity
- `type`: Grouping name (e.g., "bank accounts")
- `category`: Specific classification name
- `display_order`: Sort order in UI

**Security**: No RLS, system table only

### account_classifications
**Purpose**: User-specific customizable copies

**Key Columns**:
- `user_id`: Owner of this classification
- `template_id`: Link to source template (NULL for custom)
- `class`: Locked, from template
- `type`: Locked, from template
- `category`: Original category name
- `display_name`: User's custom display name (NULL = use category)
- `is_custom`: TRUE if user created, FALSE if from template
- `is_active`: User can deactivate classifications

**Security**: Full RLS, users see only their own data

## API Layer

### Basic Entity API
```javascript
import { AccountClassification } from '@/api/entities';

// Standard CRUD operations
await AccountClassification.list();
await AccountClassification.get(id);
await AccountClassification.create(data);
await AccountClassification.update(id, data);
```

### Specialized Classification API
```javascript
import { accountClassifications } from '@/api/accountClassifications';

// Get all active classifications
const all = await accountClassifications.getAll();

// Filter by class
const assets = await accountClassifications.getByClass('asset');

// Filter by type
const bankAccounts = await accountClassifications.getByType('bank accounts');

// Filter by both
const checking = await accountClassifications.getByClassAndType('asset', 'bank accounts');

// Get available types
const types = await accountClassifications.getTypes('asset');

// Update display name only
await accountClassifications.updateDisplayName(id, 'My Custom Name');

// Create custom classification
await accountClassifications.createCustom({
  class: 'asset',
  type: 'investments',
  category: 'crypto savings',
  display_name: 'Crypto Savings Account'
});

// Toggle active status
await accountClassifications.toggleActive(id, false);

// Delete custom classification (system ones can't be deleted)
await accountClassifications.deleteCustom(id);

// Helper functions
const displayName = accountClassifications.getDisplayName(classification);
const isSystem = accountClassifications.isSystemDefined(classification);
```

## React Hooks

### useAccountClassifications
```javascript
import { useAccountClassifications } from '@/hooks/useAccountClassifications';

function MyComponent() {
  const {
    classifications,  // All classifications
    types,           // Unique types
    isLoading,
    getByType,       // Filter by type
    getById,         // Get single classification
    getDisplayName   // Get display name (custom or default)
  } = useAccountClassifications({ classFilter: 'asset' });

  // Example: Get all checking accounts
  const checkingAccounts = getByType('bank accounts');

  return (...);
}
```

### useAccountClassification (Single)
```javascript
import { useAccountClassification } from '@/hooks/useAccountClassifications';

function AccountDisplay({ classificationId }) {
  const { classification, isLoading } = useAccountClassification(classificationId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <span>{classification.class}</span> →
      <span>{classification.type}</span> →
      <span>{classification.category}</span>
    </div>
  );
}
```

## UI Components

### AccountClassificationSelector
Type-first cascading selector component:

```javascript
import AccountClassificationSelector from '@/components/common/AccountClassificationSelector';

function CreateAccountForm() {
  const [classificationId, setClassificationId] = useState(null);

  return (
    <AccountClassificationSelector
      value={classificationId}
      onValueChange={setClassificationId}
      classFilter="asset"  // Optional: filter by class
      label="Account Type"
      required
      error={validationError}
    />
  );
}
```

**Features**:
- Type selection first (narrows category list)
- Visual class badges (color-coded by class)
- Search within categories
- Shows custom badge for user-created classifications
- Displays full hierarchy: class › type › category

## Account Tables

All account-related tables now have `account_classification_id` foreign key:
- `accounts` table
- `assets` table
- `liabilities` table
- `equity` table

## Data Migration

Existing accounts were automatically migrated:

| Old account_type | Mapped to Classification |
|-----------------|-------------------------|
| checking | asset › bank accounts › checking |
| savings | asset › bank accounts › savings |
| credit_card | liability › credit card › personal credit card |
| investment | asset › investments › brokerage |
| cash | asset › cash › physical cash |
| loan | liability › loans & debt › personal loan |

## Usage Examples

### Creating an Account with Classification
```javascript
// 1. User selects classification in UI
const selectedClassificationId = '...';

// 2. Create account with classification
const newAccount = await Account.create({
  account_name: 'My Checking',
  account_classification_id: selectedClassificationId,
  current_balance: 1000
});

// 3. Fetch and display with classification
const { classification } = useAccountClassification(newAccount.account_classification_id);
console.log(`${classification.class} › ${classification.type} › ${classification.category}`);
```

### Filtering Accounts by Classification
```javascript
import { accountClassifications } from '@/api/accountClassifications';

// Get classification ID for checking accounts
const checkingClassification = await accountClassifications.getByClassAndType(
  'asset',
  'bank accounts'
).then(results => results.find(c => c.category === 'checking'));

// Filter accounts by classification
const checkingAccounts = await Account.filter({
  account_classification_id: checkingClassification.id
});
```

### Customizing Display Names
```javascript
// User can rename "checking" to "Checking Account"
await accountClassifications.updateDisplayName(
  classificationId,
  'Checking Account'
);

// System still knows it's class="asset", type="bank accounts", category="checking"
// But displays as "Checking Account" for this user
```

## Complete Classification List

### Assets (23 classifications)

**Cash** (5):
- physical cash, cash on hand, digital wallet cash, petty cash, emergency cash

**Bank Accounts** (4):
- checking, savings, high yield savings, money market

**Investments** (9):
- brokerage, 401k, traditional ira, roth ira, hsa investment, 529 plan, crypto wallet, private investment, other investment

**Real Estate** (4):
- primary residence, secondary residence, land, other property

**Vehicle** (3):
- personal vehicle, recreational vehicle, other vehicle

**Personal Property** (4):
- valuables, collectibles, art, other personal property

### Liabilities (10 classifications)

**Credit Card** (2):
- personal credit card, business credit card

**Loans & Debt** (8):
- mortgage primary, mortgage secondary, auto loan, recreational vehicle loan, student loan, personal loan, line of credit, medical debt, other debt

### Income (10 classifications)

**Earned Income** (4):
- salary, bonus, commission, side income

**Passive & Other Income** (6):
- interest, dividends, investment income, rental income personal, gifts received, other income

### Expense (42 classifications)

**Housing** (4):
- housing, rent / mortgage, home maintenance, hoa fees

**Utilities** (3):
- utilities, internet, phone

**Food & Dining** (2):
- groceries, dining out

**Transportation** (4):
- transportation, gas & fuel, vehicle maintenance, insurance

**Healthcare** (2):
- healthcare, medical expenses

**Kids & Family** (2):
- kids & family, childcare

**Education** (2):
- education, tuition

**Subscriptions** (1):
- subscriptions

**Shopping** (1):
- shopping

**Travel** (1):
- travel

**Lifestyle** (2):
- lifestyle, entertainment

**Pets** (1):
- pets

**Financial** (2):
- financial fees, bank fees

**Giving** (2):
- giving, donations

**Taxes** (1):
- taxes

### Equity (3 classifications)

**Equity Adjustments** (3):
- opening balance equity, owner contributions, owner distributions

## Future Enhancements

### Suggested Classification
When creating accounts via API integration (like Plaid), the system can suggest the appropriate classification based on account type.

### Bulk Operations
Add ability to bulk update display names or reclassify multiple accounts at once.

### Classification Analytics
Group financial reports and dashboards by classification hierarchy for better insights.

### Business Account Support
The system is ready for business accounts - just add more templates with appropriate business-focused classifications.

## Troubleshooting

### User doesn't see classifications
- Check if auto-provisioning trigger is working
- Manually provision: `SELECT copy_account_classification_templates_to_user('user_id');`

### Can't modify class or type
- This is by design - class and type are locked for consistency
- Users can only modify display_name or create custom categories

### Custom classification not showing
- Verify is_active = true
- Check is_custom = true for user-created ones
- Ensure user_id matches current user

## Technical Notes

- **Auto-provisioning**: Trigger fires on `auth.users` INSERT
- **RLS**: All user tables use optimized `(SELECT auth.uid())` pattern
- **Indexes**: Composite indexes on (user_id, class), (user_id, type) for performance
- **Soft Deletes**: Use is_active flag instead of hard deletes
- **Migrations**: All existing accounts migrated to new system automatically
