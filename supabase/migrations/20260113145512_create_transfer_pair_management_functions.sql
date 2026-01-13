/*
  # Create Transfer Pair Management Functions

  1. New Functions
    - `link_transfer_pair(transaction_id_1, transaction_id_2)` - Links two transactions as a transfer pair
    - `unlink_transfer_pair(transaction_id)` - Unlinks a transaction from its transfer pair

  2. Validation
    - Ensures transactions belong to the same profile
    - Validates amounts are equal but opposite signs
    - Prevents linking transactions from the same account
    - Prevents linking already-paired transactions

  3. Security
    - Functions use SECURITY DEFINER to update transfer_pair_id
    - RLS policies still enforce profile-level access control
*/

-- Function to link two transactions as a transfer pair
CREATE OR REPLACE FUNCTION link_transfer_pair(
  p_transaction_id_1 uuid,
  p_transaction_id_2 uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn1 record;
  v_txn2 record;
  v_new_pair_id uuid;
BEGIN
  -- Fetch both transactions
  SELECT * INTO v_txn1
  FROM transactions
  WHERE id = p_transaction_id_1 AND profile_id = p_profile_id;

  SELECT * INTO v_txn2
  FROM transactions
  WHERE id = p_transaction_id_2 AND profile_id = p_profile_id;

  -- Validate transactions exist
  IF v_txn1 IS NULL OR v_txn2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both transactions not found');
  END IF;

  -- Validate transactions are not from the same account
  IF v_txn1.account_id = v_txn2.account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot link transactions from the same account');
  END IF;

  -- Validate neither transaction is already paired
  IF v_txn1.transfer_pair_id IS NOT NULL OR v_txn2.transfer_pair_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both transactions are already paired');
  END IF;

  -- Validate amounts are equal but opposite signs
  IF ABS(v_txn1.amount) != ABS(v_txn2.amount) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction amounts must be equal');
  END IF;

  IF SIGN(v_txn1.amount) = SIGN(v_txn2.amount) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction amounts must have opposite signs');
  END IF;

  -- Generate new pair ID
  v_new_pair_id := gen_random_uuid();

  -- Update both transactions
  UPDATE transactions
  SET
    transfer_pair_id = v_new_pair_id,
    transaction_type = 'transfer',
    updated_at = now()
  WHERE id IN (p_transaction_id_1, p_transaction_id_2)
    AND profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_pair_id', v_new_pair_id
  );
END;
$$;

-- Function to unlink a transaction from its transfer pair
CREATE OR REPLACE FUNCTION unlink_transfer_pair(
  p_transaction_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn record;
  v_pair_id uuid;
BEGIN
  -- Fetch the transaction
  SELECT * INTO v_txn
  FROM transactions
  WHERE id = p_transaction_id AND profile_id = p_profile_id;

  -- Validate transaction exists
  IF v_txn IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Validate transaction is paired
  IF v_txn.transfer_pair_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction is not part of a transfer pair');
  END IF;

  v_pair_id := v_txn.transfer_pair_id;

  -- Update both transactions in the pair
  UPDATE transactions
  SET
    transfer_pair_id = NULL,
    transaction_type = 'expense',  -- Reset to default, user can change if needed
    updated_at = now()
  WHERE transfer_pair_id = v_pair_id
    AND profile_id = p_profile_id;

  RETURN jsonb_build_object('success', true);
END;
$$;