import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { LogOut, Clock, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PendingHouseholdScreen({ onStatusChange }) {
  const [request, setRequest] = useState(null);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadRequest();
    const interval = setInterval(checkForApproval, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('household_join_requests')
      .select('*, target_profile:profiles!household_join_requests_target_profile_id_fkey(display_name)')
      .eq('requester_user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    setRequest(data);
  };

  const checkForApproval = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from('profile_memberships')
        .select('profile_id, role')
        .eq('user_id', user.id)
        .eq('role', 'owner');

      if (!memberships?.length) {
        onStatusChange();
        return;
      }

      const { data: pendingProfile } = await supabase
        .from('profiles')
        .select('household_status')
        .in('id', memberships.map(m => m.profile_id))
        .eq('household_status', 'pending')
        .maybeSingle();

      if (!pendingProfile) {
        onStatusChange();
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase.rpc('cancel_household_request');
      if (error) throw error;
      toast.success('Request cancelled');
      onStatusChange();
    } catch {
      toast.error('Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const ownerName = request?.target_profile?.display_name || 'the household owner';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            FIRST <span className="text-blue-600">SAVVY</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-100 mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-900">Waiting for approval</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your request to join <span className="font-medium text-slate-700">{ownerName}</span>'s household
              has been sent. You'll get full access once they approve.
            </p>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-700 font-medium">Request pending</span>
          </div>

          {/* Info */}
          <p className="text-xs text-slate-400">
            This page will automatically update when your request is approved or declined.
          </p>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={checkForApproval}
              disabled={checking}
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Check for updates'}
            </Button>

            <Button
              variant="ghost"
              className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <X className="w-4 h-4" />
              {cancelling ? 'Cancelling...' : 'Cancel request'}
            </Button>
          </div>
        </div>

        {/* Sign out */}
        <div className="text-center mt-6">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
