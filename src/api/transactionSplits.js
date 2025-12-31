import { supabase } from './supabaseClient';

export async function getTransactionSplits(transactionId) {
  const { data, error } = await supabase
    .from('transaction_splits')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createTransactionSplits(transactionId, profileId, userId, splits) {
  const splitsToInsert = splits.map(split => ({
    transaction_id: transactionId,
    profile_id: profileId,
    user_id: userId,
    category_account_id: split.category_account_id,
    amount: Math.abs(parseFloat(split.amount)),
    description: split.description || null
  }));

  const { data, error } = await supabase
    .from('transaction_splits')
    .insert(splitsToInsert)
    .select();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ is_split: true })
    .eq('id', transactionId);

  if (updateError) throw updateError;

  return data;
}

export async function updateTransactionSplits(transactionId, profileId, userId, splits) {
  await deleteTransactionSplits(transactionId);
  return await createTransactionSplits(transactionId, profileId, userId, splits);
}

export async function deleteTransactionSplits(transactionId) {
  const { error: deleteError } = await supabase
    .from('transaction_splits')
    .delete()
    .eq('transaction_id', transactionId);

  if (deleteError) throw deleteError;

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ is_split: false })
    .eq('id', transactionId);

  if (updateError) throw updateError;

  return true;
}

export async function validateSplitTotal(transactionId) {
  const { data, error } = await supabase
    .rpc('validate_transaction_splits', { p_transaction_id: transactionId });

  if (error) throw error;
  return data?.[0] || { is_valid: false, transaction_amount: 0, splits_total: 0, difference: 0 };
}
