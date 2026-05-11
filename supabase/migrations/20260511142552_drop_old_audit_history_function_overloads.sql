/*
  # Drop old audit history function overloads

  The previous migration created new versions of the audit history functions
  with a different parameter order, causing PGRST203 ambiguity errors.
  This drops the old signatures (p_start_date/p_end_date before p_limit/p_offset).
*/

DROP FUNCTION IF EXISTS get_account_audit_history_paginated(uuid, uuid, date, date, integer, integer);
DROP FUNCTION IF EXISTS get_multi_account_audit_history_paginated(uuid, uuid[], date, date, integer, integer);
