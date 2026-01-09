import { supabase } from './supabaseClient';

export async function getViewPreferences(profileId, viewName) {
  if (!profileId || !viewName) {
    console.warn('getViewPreferences: Missing profileId or viewName');
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('profile_view_preferences')
      .select('preferences')
      .eq('profile_id', profileId)
      .eq('view_name', viewName)
      .maybeSingle();

    if (error) {
      console.error('Error loading view preferences:', error);
      return { data: null, error };
    }

    return { data: data?.preferences || null, error: null };
  } catch (err) {
    console.error('Exception loading view preferences:', err);
    return { data: null, error: err };
  }
}

export async function saveViewPreferences(profileId, viewName, preferences) {
  if (!profileId || !viewName) {
    console.warn('saveViewPreferences: Missing profileId or viewName');
    return { data: null, error: new Error('Missing required parameters') };
  }

  try {
    const { data, error } = await supabase
      .from('profile_view_preferences')
      .upsert(
        {
          profile_id: profileId,
          view_name: viewName,
          preferences: preferences || {},
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'profile_id,view_name',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving view preferences:', error);
      return { data: null, error };
    }

    return { data: data?.preferences || preferences, error: null };
  } catch (err) {
    console.error('Exception saving view preferences:', err);
    return { data: null, error: err };
  }
}

export async function deleteViewPreferences(profileId, viewName) {
  if (!profileId || !viewName) {
    console.warn('deleteViewPreferences: Missing profileId or viewName');
    return { error: new Error('Missing required parameters') };
  }

  try {
    const { error } = await supabase
      .from('profile_view_preferences')
      .delete()
      .eq('profile_id', profileId)
      .eq('view_name', viewName);

    if (error) {
      console.error('Error deleting view preferences:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Exception deleting view preferences:', err);
    return { error: err };
  }
}

export async function deleteAllViewPreferences(profileId) {
  if (!profileId) {
    console.warn('deleteAllViewPreferences: Missing profileId');
    return { error: new Error('Missing required parameters') };
  }

  try {
    const { error } = await supabase
      .from('profile_view_preferences')
      .delete()
      .eq('profile_id', profileId);

    if (error) {
      console.error('Error deleting all view preferences:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Exception deleting all view preferences:', err);
    return { error: err };
  }
}
