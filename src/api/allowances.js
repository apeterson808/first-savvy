import { supabase } from './supabaseClient';

export const allowancesAPI = {
  async getAllowanceSchedules(childId) {
    const { data, error } = await supabase
      .from('allowance_schedules')
      .select('*')
      .eq('child_profile_id', childId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createAllowanceSchedule(childId, scheduleData) {
    const { data, error } = await supabase
      .from('allowance_schedules')
      .insert({
        child_profile_id: childId,
        amount: scheduleData.amount,
        frequency: scheduleData.frequency,
        mode: scheduleData.mode,
        points_amount: scheduleData.points_amount || 0,
        cash_amount: scheduleData.cash_amount || 0,
        next_payment_date: scheduleData.next_payment_date,
        created_by_user_id: scheduleData.created_by_user_id,
        auto_deposit: scheduleData.auto_deposit !== false,
        notes: scheduleData.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAllowanceSchedule(scheduleId, updates) {
    const { data, error } = await supabase
      .from('allowance_schedules')
      .update(updates)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAllowanceSchedule(scheduleId) {
    const { error } = await supabase
      .from('allowance_schedules')
      .update({ is_active: false })
      .eq('id', scheduleId);

    if (error) throw error;
  },

  async processAllowancePayment(scheduleId) {
    const { data: schedule, error: scheduleError } = await supabase
      .from('allowance_schedules')
      .select('*, child_profiles(*)')
      .eq('id', scheduleId)
      .single();

    if (scheduleError) throw scheduleError;

    const updates = {};
    const transactions = [];

    if (schedule.mode === 'points' || schedule.mode === 'both') {
      updates.points_balance = schedule.child_profiles.points_balance + schedule.points_amount;
      transactions.push({
        child_profile_id: schedule.child_profile_id,
        transaction_type: 'allowance',
        amount: schedule.points_amount,
        currency_type: 'points',
        description: `${schedule.frequency} allowance payment`,
        status: 'completed',
        related_allowance_id: scheduleId,
        balance_after: updates.points_balance,
      });
    }

    if (schedule.mode === 'cash' || schedule.mode === 'both') {
      updates.cash_balance = parseFloat(schedule.child_profiles.cash_balance) + parseFloat(schedule.cash_amount);
      transactions.push({
        child_profile_id: schedule.child_profile_id,
        transaction_type: 'allowance',
        amount: schedule.cash_amount,
        currency_type: 'cash',
        description: `${schedule.frequency} allowance payment`,
        status: 'completed',
        related_allowance_id: scheduleId,
        balance_after: updates.cash_balance,
      });
    }

    const { error: updateError } = await supabase
      .from('child_profiles')
      .update(updates)
      .eq('id', schedule.child_profile_id);

    if (updateError) throw updateError;

    for (const transaction of transactions) {
      await supabase
        .from('child_transactions')
        .insert(transaction);
    }

    const nextDate = this.calculateNextPaymentDate(
      schedule.next_payment_date,
      schedule.frequency
    );

    const { data, error } = await supabase
      .from('allowance_schedules')
      .update({
        last_payment_date: schedule.next_payment_date,
        next_payment_date: nextDate,
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  calculateNextPaymentDate(fromDate, frequency) {
    const date = new Date(fromDate);

    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }

    return date.toISOString().split('T')[0];
  },

  async getDueAllowances() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('allowance_schedules')
      .select('*, child_profiles(*)')
      .eq('is_active', true)
      .eq('auto_deposit', true)
      .lte('next_payment_date', today);

    if (error) throw error;
    return data;
  },

  async processDueAllowances() {
    const dueSchedules = await this.getDueAllowances();

    const results = [];
    for (const schedule of dueSchedules) {
      try {
        const result = await this.processAllowancePayment(schedule.id);
        results.push({ scheduleId: schedule.id, success: true, data: result });
      } catch (error) {
        results.push({ scheduleId: schedule.id, success: false, error: error.message });
      }
    }

    return results;
  },
};
