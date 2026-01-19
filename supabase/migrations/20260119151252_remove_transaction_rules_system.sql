/*
  # Remove Transaction Rules System

  This migration removes all transaction rules functionality from the database.

  1. Tables Dropped
    - `categorization_rules` - User-defined categorization rules (if exists)
    - `contact_matching_rules` - Contact matching rules (if exists)

  2. Reasoning
    - Preparing for a new, simpler rules system
    - Removing complexity from the current system
*/

-- Drop categorization rules table
DROP TABLE IF EXISTS categorization_rules CASCADE;

-- Drop contact matching rules table  
DROP TABLE IF EXISTS contact_matching_rules CASCADE;