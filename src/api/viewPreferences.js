import { supabase } from './supabaseClient';

export async function getViewPreferences(profileId, viewName) {
  if (!profileId || !viewName) {
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
      return { data: null, error };
    }

    return { data: data?.preferences || null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function saveViewPreferences(profileId, viewName, preferences) {
  if (!profileId || !viewName) {
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
      return { data: null, error };
    }

    return { data: data?.preferences || preferences, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function deleteViewPreferences(profileId, viewName) {
  if (!profileId || !viewName) {
    return { error: new Error('Missing required parameters') };
  }

  try {
    const { error } = await supabase
      .from('profile_view_preferences')
      .delete()
      .eq('profile_id', profileId)
      .eq('view_name', viewName);

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

export async function deleteAllViewPreferences(profileId) {
  if (!profileId) {
    return { error: new Error('Missing required parameters') };
  }

  try {
    const { error } = await supabase
      .from('profile_view_preferences')
      .delete()
      .eq('profile_id', profileId);

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (err) {
    return { error: err };
  }
}
