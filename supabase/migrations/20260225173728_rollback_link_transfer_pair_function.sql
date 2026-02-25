/*
  # Rollback: Remove link_transfer_pair function

  This migration removes the link_transfer_pair function that was added.
*/

DROP FUNCTION IF EXISTS link_transfer_pair(UUID, UUID, UUID);
