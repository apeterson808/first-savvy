import { supabase } from './supabaseClient';

const CHILD_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet (only used for child colors, not app chrome)
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const calendarPreferencesAPI = {
  async getPreferences(profileId) {
    const { data, error } = await supabase
      .from('calendar_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertPreferences(profileId, prefs) {
    const { data, error } = await supabase
      .from('calendar_preferences')
      .upsert(
        { profile_id: profileId, ...prefs, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  assignColorsToChildren(children, existingColors = {}) {
    const result = { ...existingColors };
    let colorIndex = 0;

    const usedColors = new Set(Object.values(existingColors));

    children.forEach((child) => {
      if (!result[child.id]) {
        while (usedColors.has(CHILD_COLOR_PALETTE[colorIndex % CHILD_COLOR_PALETTE.length])) {
          colorIndex++;
        }
        result[child.id] = CHILD_COLOR_PALETTE[colorIndex % CHILD_COLOR_PALETTE.length];
        usedColors.add(result[child.id]);
        colorIndex++;
      }
    });

    return result;
  },
};
