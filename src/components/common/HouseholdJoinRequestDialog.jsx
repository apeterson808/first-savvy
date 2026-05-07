import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { UserCheck, Eye, X } from 'lucide-react';

const ROLES = [
  {
    value: 'spouse_full',
    label: 'Spouse / Partner — Full Access',
    description: 'Shares your profile completely. Can view and edit everything: banking, budgets, contacts, tasks.',
    icon: UserCheck,
    color: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    activeColor: 'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
    iconColor: 'text-blue-600',
  },
  {
    value: 'spouse_view',
    label: 'Spouse / Partner — View Only',
    description: 'Can see all your data but cannot add, edit, or delete anything.',
    icon: Eye,
    color: 'border-slate-200 bg-slate-50 hover:bg-slate-100',
    activeColor: 'border-slate-400 bg-slate-100 ring-2 ring-slate-400',
    iconColor: 'text-slate-600',
  },
];

export default function HouseholdJoinRequestDialog({ request, open, onOpenChange, onResolved }) {
  const [selectedRole, setSelectedRole] = useState('spouse_full');
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const { data, error } = await supabase.rpc('approve_household_request', {
        p_request_id: request.id,
        p_role: selectedRole,
      });
      if (error) throw error;
      toast.success(`${request.requester_display_name} has been added to your household`);
      onResolved('approved');
    } catch (err) {
      toast.error('Failed to approve request');
    } finally {
      setApproving(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const { error } = await supabase.rpc('decline_household_request', {
        p_request_id: request.id,
      });
      if (error) throw error;
      toast.success('Request declined');
      onResolved('declined');
    } catch (err) {
      toast.error('Failed to decline request');
    } finally {
      setDeclining(false);
    }
  };

  if (!request) return null;

  const initials = (request.requester_display_name || request.requester_email)
    .slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Household Join Request</DialogTitle>
          <DialogDescription>
            Someone wants to join your household. Choose their access level.
          </DialogDescription>
        </DialogHeader>

        {/* Requester card */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">{request.requester_display_name || request.requester_email}</p>
            <p className="text-sm text-slate-500 truncate">{request.requester_email}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Requested {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Role picker */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Select their role</p>
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                  isSelected ? role.activeColor : role.color
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${role.iconColor}`} />
                <div>
                  <p className="font-medium text-slate-900 text-sm">{role.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDecline}
            disabled={approving || declining}
          >
            <X className="w-4 h-4 mr-1.5" />
            {declining ? 'Declining...' : 'Decline'}
          </Button>
          <Button
            className="flex-1"
            onClick={handleApprove}
            disabled={approving || declining}
          >
            <UserCheck className="w-4 h-4 mr-1.5" />
            {approving ? 'Approving...' : 'Approve & Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
