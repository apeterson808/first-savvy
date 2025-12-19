/*
  # Add Contact Dropdown to Protected Configurations

  1. Purpose
    - Registers the ContactDropdown component as a protected configuration in Supabase
    - Enables version tracking, change history, and accidental modification prevention
    - Allows lock/unlock functionality and version restoration from Settings

  2. Protected Configuration Details
    - Component: ContactDropdown
    - Key protected logic:
      * Active status filtering (line 44)
      * AI suggestion prioritization and display
      * Display name integration
      * Contact list ordering and availability rules

  3. Security
    - Configuration is locked by default to prevent accidental changes
    - All modifications are tracked with full change history
    - Can be managed from Settings > Protected Configurations tab
*/

-- Insert the contact_dropdown_system protected configuration
INSERT INTO protected_configurations (
  name,
  description,
  version,
  content_hash,
  configuration_data,
  file_paths,
  is_locked,
  is_active,
  created_by
)
VALUES (
  'contact_dropdown_system',
  'Contact Dropdown Component and Related Logic - This configuration is protected and changes require explicit confirmation',
  '1.0.0',
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  jsonb_build_object(
    'version', '1.0.0',
    'componentName', 'ContactDropdown',
    'description', 'Protected contact dropdown filtering logic and AI suggestion handling',
    'filteringRules', jsonb_build_object(
      'activeFilter', 'Only contacts with status=active are shown',
      'aiSuggestionPriority', 'AI-suggested contacts appear first in the list with sparkle icon',
      'searchEnabled', 'Real-time search filtering of contact names'
    ),
    'displayLogic', jsonb_build_object(
      'nameField', 'Use contact.name field for display',
      'aiIndicator', 'Sparkles icon shown for AI-suggested contacts',
      'addNewOption', 'Option to add new contact appears at top when enabled'
    ),
    'aiIntegration', jsonb_build_object(
      'suggestionHandling', 'AI-suggested contact (aiSuggestionId) is automatically included and prioritized',
      'visualIndicator', 'Blue sparkle icon marks AI suggestions',
      'autoInclude', 'Suggested contacts included even if not in active list'
    ),
    'constants', jsonb_build_object(
      'specialValues', jsonb_build_array('__add_new__'),
      'statusFilter', 'active'
    )
  ),
  jsonb_build_array(
    'src/components/common/ContactDropdown.jsx'
  ),
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (name) 
DO UPDATE SET
  description = EXCLUDED.description,
  configuration_data = EXCLUDED.configuration_data,
  file_paths = EXCLUDED.file_paths,
  updated_at = now();
