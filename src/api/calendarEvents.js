import { supabase } from './supabaseClient';

export const calendarEventsAPI = {
  async getEventsForRange(profileId, startDate, endDate) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          display_name,
          avatar_url
        )
      `)
      .eq('profile_id', profileId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });

    if (error) throw error;
    return data;
  },

  async createEvent(profileId, eventData) {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        profile_id: profileId,
        title: eventData.title,
        description: eventData.description || '',
        event_date: eventData.event_date,
        start_time: eventData.start_time || null,
        end_time: eventData.end_time || null,
        all_day: eventData.all_day !== false,
        assigned_to_child_id: eventData.assigned_to_child_id || null,
        color: eventData.color || '#3b82f6',
        icon: eventData.icon || 'Calendar',
      })
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvent(eventId, updates) {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select(`
        *,
        child_profiles (
          id,
          child_name,
          display_name,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEvent(eventId) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  },
};
