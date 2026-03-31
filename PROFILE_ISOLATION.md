# Profile Isolation Architecture

## Overview

This application implements a **multi-profile system** where each profile is an isolated container with its own data. Profiles do not share data unless explicitly linked through the child profile sharing system.

## Profile Types

### 1. Personal Profiles
- Created for each user account
- Linked via `profile_memberships` table
- Users can have multiple personal profiles
- Each profile has completely isolated financial data

### 2. Child Profiles
- Virtual profiles for children managed by parents
- Use `owned_by_profile_id` as their virtual profile ID
- Can be shared with up to 4 adults via `profile_shares`
- Have graduated permission levels (1-5)
- Isolated from parent's financial data unless explicitly shared

## Data Isolation Mechanisms

### 1. Database Level (RLS Policies)

All profile-scoped tables have Row Level Security (RLS) enabled with policies that filter by:
```sql
profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
```

**Profile-Scoped Tables (40+ tables):**
- transactions
- budgets
- contacts
- user_chart_of_accounts
- transaction_rules
- journal_entries
- journal_entry_lines
- transaction_splits
- chores
- rewards
- vault_items
- vault_folders
- csv_column_mapping_configs
- And many more...

### 2. Application Level (ProfileContext)

The `ProfileContext` manages:
- Active profile selection
- Profile switching
- Access control validation
- Child profile loading

```javascript
const { activeProfile } = useProfile();
// activeProfile.id is used to filter all queries
```

### 3. API Level (Explicit Filtering)

All API queries **must** filter by profile_id:

```javascript
// CORRECT - Explicit filtering
.from('budgets')
.select('*')
.eq('profile_id', profileId)

// WRONG - Relies only on RLS
.from('budgets')
.select('*')
```

**Generic Entity API** automatically adds profile_id filtering for tables in `TABLES_WITH_PROFILE_ID` list.

## Profile Creation & Provisioning

When a new profile is created via `manual_provision_current_user()`:

1. **Profile record** created in `profiles` table
2. **Membership** created in `profile_memberships`
3. **Tab** created in `profile_tabs`
4. **Chart of Accounts** copied from templates (all inactive by default)
5. **Isolation** guaranteed - no data shared with other profiles

## Child Profile Isolation

Child profiles use a **dual-ID system**:
- `child_profiles.id` - Physical record ID
- `child_profiles.owned_by_profile_id` - Virtual profile ID (used as profile_id for queries)

This allows children to have completely isolated financial data while being managed by parents.

## Important Implementation Rules

### ✅ DO

1. **Always filter by profile_id** in queries
2. **Use activeProfile.id** from ProfileContext
3. **Pass profileId** explicitly to API functions
4. **Enable RLS** on all new profile-scoped tables
5. **Test isolation** when creating new features

### ❌ DON'T

1. **Don't rely only on RLS** - use explicit filtering
2. **Don't use global state** for profile data
3. **Don't skip profile_id** in JOIN queries
4. **Don't assume data is isolated** - verify it
5. **Don't create cross-profile queries** without authorization checks

## Verification Checklist

When adding a new feature with profile data:

- [ ] Table has `profile_id uuid NOT NULL` column
- [ ] RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- [ ] RLS policies check profile_id
- [ ] API queries filter by profile_id explicitly
- [ ] React Query keys include profile_id for cache isolation
- [ ] Table is added to `TABLES_WITH_PROFILE_ID` list if using generic API

## Security Layers (Defense in Depth)

1. **Database RLS** - Primary security boundary
2. **API Filtering** - Prevents accidental data leaks
3. **Context Validation** - Ensures user has access to profile
4. **Query Key Isolation** - Separates cached data by profile

## Common Pitfalls

### ❌ Missing Profile Filter
```javascript
// WRONG - No profile filtering
const { data } = await supabase
  .from('budgets')
  .select('*');
```

### ✅ Correct Profile Filter
```javascript
// CORRECT - Explicit profile filtering
const { data } = await supabase
  .from('budgets')
  .select('*')
  .eq('profile_id', activeProfile.id);
```

### ❌ JOIN Without Verification
```javascript
// RISKY - Relies only on RLS
const { data } = await supabase
  .from('journal_entry_lines')
  .select('*, account:user_chart_of_accounts(*)');
```

### ✅ JOIN With Verification
```javascript
// BETTER - Verify profile ownership
const { data } = await supabase
  .from('journal_entry_lines')
  .select('*, account:user_chart_of_accounts(*)')
  .eq('profile_id', profileId);
```

## Testing Profile Isolation

To verify isolation is working:

1. Create two profiles for the same user
2. Add data to profile A
3. Switch to profile B
4. Verify profile A's data is NOT visible
5. Try to query profile A's data with profile B's ID
6. Verify RLS blocks the query

## Updates to This Document

When making changes that affect profile isolation:

1. Update this document
2. Review all affected queries
3. Test isolation thoroughly
4. Document any new patterns or exceptions
