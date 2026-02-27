import { supabase } from './supabaseClient';

export const matchingAPI = {
  async detectMatches(profileId, transactionIds = null) {
    return { data: null, error: { message: 'Automatic matching is disabled' } };
  },

  async getUnreviewedMatches(profileId, matchType = null) {
    return { data: [], error: null };
  },

  async acceptMatch(transactionId, profileId) {
    return { error: { message: 'Matching is disabled' } };
  },

  async rejectMatch(transactionId, profileId, userId) {
    return { error: { message: 'Matching is disabled' } };
  },

  async linkManual(transactionId1, transactionId2, matchType, profileId, userId) {
    return { error: { message: 'Matching is disabled' } };
  },

  async unmatch(transactionId, profileId) {
    return { error: { message: 'Matching is disabled' } };
  },

  async getSuggestedMatches(transactionId, profileId) {
    return { data: [], error: null };
  },

  async getMatchHistory(profileId, limit = 100) {
    return { data: [], error: null };
  }
};
