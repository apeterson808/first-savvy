# Quick Create Rule Dialog - Redesign Implementation

## Overview
Complete redesign of the Quick Create Rule dialog with a QuickBooks-inspired two-column layout and live preview functionality.

## Key Features Implemented

### 1. Database Enhancements
- **New Fields Added:**
  - `match_bank_account_ids` (uuid[]): Support for multiple account selection
  - `match_money_direction` (text): Filter by Money In, Money Out, or Both
  - `match_original_description_pattern` (text): Search bank memo (original description)
  - `match_conditions_logic` (text): AND/OR logic for multiple conditions
  - `action_set_description` (text): Bulk description changes
  - `auto_confirm_and_post` (boolean): Automatic posting of matched transactions

- **Unique Constraint:** Rule names must be unique per profile (case-insensitive)

### 2. Two-Column Layout
- **Left Column:** Rule configuration form with all settings
- **Right Column:** Live preview showing matching pending transactions
- **Top Header:** Compact transaction display showing original transaction details

### 3. Rule Name Validation
- Real-time duplicate name checking with 500ms debounce
- Visual error feedback with red border and error message
- Create button disabled when name error exists
- Database-backed validation using unique index

### 4. Apply To Section
- **Money Direction Dropdown:**
  - Both (Money In & Out)
  - Money In
  - Money Out

- **Multi-Select Account Dropdown:**
  - Checkboxes for each account
  - "All Accounts" option at top with select/deselect all
  - Shows count when multiple selected
  - Only displays accounts with `display_in_sidebar = true`

### 5. Search Conditions Builder
- **Dynamic Condition Rows:**
  - Add/remove multiple conditions
  - Each row has: Field dropdown, Operator dropdown, Value input
  - Visual "and" or "or" between rows based on match logic

- **Field Options:**
  - Description: Searches current transaction description
  - Bank Memo: Searches original_description (preserved bank data)
  - Amount: Numeric matching

- **Operators (context-dependent):**
  - Text fields: Contains, Exact Match, Starts With, Ends With
  - Amount: Equal To, Greater Than, Less Than

- **Match Logic Toggle:**
  - All (AND): Transaction must match all conditions
  - Any (OR): Transaction must match any condition

### 6. Actions Section (Then)
- **Change Description To:** Bulk update transaction descriptions (preserves bank memo)
- **Set Category:** Bulk categorize transactions
- **Add Notes:** Append notes to matched transactions
- At least one action required to create rule

### 7. Auto-Confirm Toggle
- Prominent toggle switch with clear label
- When enabled, matching transactions automatically move to "posted" status
- Helper text explains behavior
- Defaults to disabled for safety

### 8. Live Preview Panel
- **Real-Time Updates:**
  - Debounced preview (500ms) triggered on any form change
  - Shows only pending transactions
  - Ordered by date descending
  - Limit of 10 transactions displayed

- **Before/After Display:**
  - Shows current values with strikethrough
  - Arrow icon indicates changes
  - Highlights proposed changes in blue
  - Shows auto-post status in green

- **Loading States:**
  - Spinner during preview fetch
  - Empty state with helpful message when no matches

### 9. Removed Features
- Priority field (no longer visible in UI, defaults to 50 in database)
- Test button (replaced by always-on live preview)

## API Updates

### Enhanced `getMatchPreview` Function
- Filters to only show `status = 'pending'` transactions
- Supports `match_bank_account_ids` array
- Supports `match_original_description_pattern` for bank memo search
- Supports `match_money_direction` filtering
- Orders by date descending
- Default limit increased to 10

### New `checkRuleNameUnique` Function
- Validates rule name uniqueness per profile
- Case-insensitive checking
- Optional exclusion of specific rule ID (for edit mode)

### Updated Database Functions
- `check_transaction_matches_rule`: Enhanced to support all new fields
- `apply_rule_to_transaction`: Handles description changes and auto-posting

## User Experience Improvements

1. **Instant Feedback:** Live preview updates as you type
2. **Clear Validation:** Real-time name uniqueness checking
3. **Visual Clarity:** Two-column layout separates configuration from results
4. **Flexible Matching:** Multiple conditions with AND/OR logic
5. **Powerful Actions:** Can change descriptions, categories, and notes in bulk
6. **Safety First:** Auto-confirm defaults to disabled, requires explicit opt-in
7. **QuickBooks-Inspired:** Familiar interface for users coming from QuickBooks

## Technical Implementation

### Components
- **QuickCreateRuleDialog.jsx:** Main component with complete redesign
- Uses React hooks for state management
- Implements debounced preview loading
- Handles multi-select account dropdown
- Dynamic condition rows with add/remove

### Validation
- Client-side validation before submission
- Server-side unique constraint enforcement
- User-friendly error messages

### Performance
- Debounced API calls (500ms) to reduce server load
- Efficient query building in preview function
- Optimized RLS policies maintained

## Migration
- Migration file: `enhance_transaction_rules_for_quickbooks_style`
- All changes are backwards compatible
- Existing rules continue to work unchanged
- New fields default to sensible values

## Future Enhancements
Potential improvements for future iterations:
- Condition grouping (nested AND/OR logic)
- Regular expression support for advanced users
- Rule templates for common scenarios
- Batch application to existing transactions
- Rule priority management UI
