import { supabase } from './supabaseClient';

export async function createJournalEntry({
  profileId,
  userId,
  entryDate,
  description,
  entryType = 'adjustment',
  source = 'manual',
  lines
}) {
  const { data, error } = await supabase.rpc('create_journal_entry', {
    p_profile_id: profileId,
    p_user_id: userId,
    p_entry_date: entryDate,
    p_description: description,
    p_entry_type: entryType,
    p_source: source,
    p_lines: lines
  });

  if (error) throw error;
  return data;
}

export async function createOpeningBalanceJournalEntry({
  profileId,
  userId,
  accountId,
  openingBalance,
  openingDate,
  accountName,
  accountClass
}) {
  const { data, error } = await supabase.rpc('create_opening_balance_journal_entry', {
    p_profile_id: profileId,
    p_user_id: userId,
    p_account_id: accountId,
    p_opening_balance: openingBalance,
    p_opening_date: openingDate,
    p_account_name: accountName,
    p_account_class: accountClass
  });

  if (error) throw error;
  return data;
}

export async function getJournalEntryWithLines(entryId) {
  const { data, error } = await supabase.rpc('get_journal_entry_with_lines', {
    p_entry_id: entryId
  });

  if (error) throw error;
  return data;
}

export async function getAccountJournalLines(profileId, accountId, startDate = null, endDate = null) {
  const { data, error } = await supabase.rpc('get_account_journal_lines', {
    p_profile_id: profileId,
    p_account_id: accountId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) throw error;
  return data || [];
}

export async function getAccountJournalLinesPaginated({
  profileId,
  accountId,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0
}) {
  const { data, error } = await supabase.rpc('get_account_journal_lines_paginated', {
    p_profile_id: profileId,
    p_account_id: accountId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
    p_offset: offset
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      lines: [],
      totalCount: 0,
      hasMore: false
    };
  }

  return {
    lines: data,
    totalCount: data[0]?.total_count || 0,
    hasMore: offset + data.length < (data[0]?.total_count || 0)
  };
}

export async function getJournalEntries(profileId, filters = {}) {
  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('profile_id', profileId)
    .order('entry_date', { ascending: false })
    .order('entry_number', { ascending: false });

  if (filters.startDate) {
    query = query.gte('entry_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('entry_date', filters.endDate);
  }

  if (filters.entryType) {
    query = query.eq('entry_type', filters.entryType);
  }

  if (filters.search) {
    query = query.or(`description.ilike.%${filters.search}%,entry_number.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getJournalEntryLines(journalEntryId) {
  const { data, error } = await supabase
    .from('journal_entry_lines')
    .select(`
      *,
      account:user_chart_of_accounts(
        id,
        account_number,
        account_name,
        account_class,
        icon,
        color
      )
    `)
    .eq('journal_entry_id', journalEntryId)
    .order('line_number');

  if (error) throw error;
  return data || [];
}

export async function updateJournalEntry(entryId, updates) {
  const { data, error } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJournalEntry(entryId) {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
}

export async function deleteJournalEntryIfUnused(entryId) {
  return deleteJournalEntry(entryId);
}

export async function getNextJournalEntryNumber(profileId) {
  const { data, error } = await supabase.rpc('get_next_journal_entry_number', {
    p_profile_id: profileId
  });

  if (error) throw error;
  return data;
}

export async function updateJournalEntryWithLines({
  entryId,
  profileId,
  description,
  memo,
  lines
}) {
  const { data, error } = await supabase.rpc('update_journal_entry_with_lines', {
    p_entry_id: entryId,
    p_profile_id: profileId,
    p_description: description,
    p_memo: memo,
    p_lines: lines
  });

  if (error) throw error;
  return data;
}

export async function getJournalEntryAttachments(journalEntryId) {
  const { data, error } = await supabase
    .from('journal_entry_attachments')
    .select('*')
    .eq('journal_entry_id', journalEntryId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadJournalEntryAttachment({
  journalEntryId,
  profileId,
  file
}) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `journal-attachments/${profileId}/${journalEntryId}/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('journal_entry_attachments')
    .insert({
      journal_entry_id: journalEntryId,
      profile_id: profileId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: filePath,
      uploaded_by: (await supabase.auth.getUser()).data.user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJournalEntryAttachment(attachmentId, storagePath) {
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([storagePath]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from('journal_entry_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}

export async function getAttachmentUrl(storagePath) {
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);

  return data?.signedUrl;
}

export async function diagnoseAccountJournalLines(accountId) {
  const { data, error } = await supabase.rpc('diagnose_account_journal_lines', {
    p_account_id: accountId
  });

  if (error) throw error;
  return data || [];
}

export async function getJournalEntryEditHistory(journalEntryId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'journal_entry')
    .eq('entity_id', journalEntryId)
    .eq('action', 'edit_journal_entry')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAccountAuditHistoryPaginated({
  profileId,
  accountId,
  startDate = null,
  endDate = null,
  limit = 100,
  offset = 0
}) {
  const { data, error } = await supabase.rpc('get_account_audit_history_paginated', {
    p_profile_id: profileId,
    p_account_id: accountId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
    p_offset: offset
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      lines: [],
      totalCount: 0,
      hasMore: false
    };
  }

  return {
    lines: data,
    totalCount: data[0]?.total_count || 0,
    hasMore: offset + data.length < (data[0]?.total_count || 0)
  };
}
