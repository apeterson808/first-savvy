# Protected Configuration System Guide

## Overview

The Category Dropdown protection system ensures that critical application components cannot be accidentally modified without explicit user confirmation. This system protects the category dropdown logic and related constants from unauthorized or accidental changes.

## Protected Components

The following files are currently protected:
- `src/components/common/CategoryDropdown.jsx` - Category filtering and display logic
- `src/components/utils/constants.jsx` - Category type labels and display functions

## Features

### 1. Database-Backed Configuration Storage
- Protected configurations are stored in the `protected_configurations` table
- Each configuration includes a content hash for integrity verification
- Version history is tracked in the `configuration_change_log` table

### 2. Change Confirmation Dialog
- When protected configurations are locked, any changes require explicit confirmation
- Users must type "I CONFIRM CATEGORY CHANGE" exactly to proceed
- The dialog shows which files will be affected and what's changing

### 3. Admin Dashboard
- Navigate to **Settings > Protected** tab
- View all protected configurations
- Lock/unlock configurations
- View change history
- See configuration details including content hashes

### 4. Integrity Checking
- The system can verify that the current code matches the protected baseline
- Integrity status is displayed in the Protected Configurations tab
- Warnings appear if differences are detected

## Using the System

### Viewing Protected Configurations
1. Go to **Settings** page
2. Click the **Protected** tab
3. You'll see a list of all protected configurations with their status

### Unlocking a Configuration
1. In the Protected Configurations tab, find the configuration you want to modify
2. Click the **Unlock** button
3. The configuration is now temporarily unlocked for modifications

### Making Changes to Protected Files
1. Ensure the configuration is unlocked (see above)
2. Edit the protected file (e.g., `CategoryDropdown.jsx`)
3. If the configuration is locked, you'll see a warning dialog
4. Type the confirmation text exactly: `I CONFIRM CATEGORY CHANGE`
5. Click **Confirm Change** to proceed

### Re-locking a Configuration
1. After making your changes, return to **Settings > Protected**
2. Click the **Lock** button on the configuration
3. The protection is now re-enabled

### Viewing Change History
1. In the Protected Configurations tab, click **History** on any configuration
2. View all past changes with timestamps, version numbers, and user information

## Configuration Details

### Category Dropdown Protection

The Category Dropdown configuration protects:

**Filtering Logic:**
- Transfer category handling (income vs expense transfers based on amount)
- Non-transfer category filtering (by type: income/expense)
- Active category filtering (excluding inactive categories)

**Display Logic:**
- `getAccountDisplayName()` function behavior
- Income/Expense categories use the `name` field
- Other account types use the `account_name` field

**AI Integration:**
- AI-suggested category display and positioning
- Sparkle icon indicator for suggestions

### Constants Protection

Protected constants include:
- `DETAIL_TYPE_LABELS` - Mapping of detail types to display names
- `DEFAULT_DETAIL_TYPES` - Default options for account type dropdowns
- `getAccountDisplayName()` - Display name formatting function
- `getDetailTypeDisplayName()` - Detail type display function

## API Usage

For programmatic access to the protection system:

```javascript
import { protectedConfigurationService } from '@/api/protectedConfigurations';
import { requireProtectedChangeConfirmation } from '@/utils/configurationProtection';

// Check if change requires confirmation
const confirmed = await requireProtectedChangeConfirmation('category_dropdown_system');

if (confirmed) {
  // Proceed with changes
}

// Get configuration details
const config = await protectedConfigurationService.getConfiguration('category_dropdown_system');

// View change history
const history = await protectedConfigurationService.getChangeHistory(config.id);
```

## Database Tables

### protected_configurations
Stores the baseline configuration snapshots:
- `name` - Unique identifier for the configuration
- `version` - Version number (semantic versioning)
- `content_hash` - SHA-256 hash for integrity checking
- `configuration_data` - JSONB containing the protected configuration
- `file_paths` - Array of protected file paths
- `is_locked` - Whether changes require confirmation
- `is_active` - Whether this is the active baseline

### configuration_change_log
Tracks all modifications:
- `configuration_id` - References the protected configuration
- `user_id` - Who made the change
- `change_type` - Type of change (update, restore, lock, unlock)
- `old_version` / `new_version` - Version tracking
- `change_description` - Human-readable description
- `diff_data` - Detailed change information
- `confirmed_at` - When the user confirmed the change

## Best Practices

1. **Only unlock when necessary** - Keep configurations locked by default
2. **Review change history regularly** - Check the History tab to monitor modifications
3. **Use descriptive change descriptions** - When modifying configurations, document what changed and why
4. **Lock after changes** - Always re-lock configurations after making approved changes
5. **Verify integrity** - Check the integrity status in the Protected tab after updates

## Troubleshooting

### "Configuration not found" error
- The initial configuration may not be seeded. Check the database for the `category_dropdown_system` record.
- If missing, the initial migration should have created it automatically.

### Changes not triggering warning dialog
- Verify the configuration is locked in Settings > Protected
- Check browser console for any errors
- Ensure the ProtectedChangeWarningDialog is mounted in the Layout component

### Integrity check failing
- This means the current code differs from the protected baseline
- Review what changes were made using version control (git)
- Update the protected configuration baseline if changes are intentional
- Use the change history to see when the deviation occurred

## Security Notes

- All configuration changes are logged with user information and timestamps
- Content hashes ensure configurations haven't been tampered with
- Row Level Security (RLS) policies restrict access to authenticated users
- The system uses SECURITY DEFINER functions for initial seeding

## Support

For issues or questions about the protected configuration system:
1. Check the change history for recent modifications
2. Verify integrity in the Protected Configurations tab
3. Review the configuration details to understand what's protected
4. Check browser console for error messages
