import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';

export default function ProfileSetupDialog({ open, onClose, currentFullName = '', currentDisplayName = 'Personal' }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Pre-populate from currentFullName if provided
  useEffect(() => {
    if (currentFullName) {
      const parts = currentFullName.trim().split(/\s+/);
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      setFirstName(first);
      setLastName(last);
      if (!displayNameTouched) {
        setDisplayName([first, last].filter(Boolean).join(' '));
      }
    }
  }, [currentFullName]);

  // Auto-update display name when first/last change, unless user has manually edited it
  useEffect(() => {
    if (!displayNameTouched) {
      setDisplayName([firstName, lastName].filter(Boolean).join(' '));
    }
  }, [firstName, lastName, displayNameTouched]);

  const validate = () => {
    const e = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!displayName.trim()) e.displayName = 'Display name is required';
    if (!phone.trim()) e.phone = 'Phone number is required';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSaving(true);
    try {
      const userId = (await firstsavvy.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const fullName = [firstName.trim(), lastName.trim()].join(' ');

      await firstsavvy
        .from('user_settings')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          display_name: displayName.trim(),
          phone: phone.trim(),
        })
        .eq('id', userId);

      const { data: membership } = await firstsavvy
        .from('profile_memberships')
        .select('profile_id')
        .eq('user_id', userId)
        .eq('role', 'owner')
        .maybeSingle();

      if (membership?.profile_id) {
        await firstsavvy
          .from('profiles')
          .update({ display_name: displayName.trim() })
          .eq('id', membership.profile_id);
      }

      toast.success('Profile updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const field = (id, label, value, setter, placeholder, extra = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-red-500">*</span>
      </Label>
      <Input
        id={id}
        type={extra.type || 'text'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setter(e.target.value);
          if (errors[id]) setErrors(prev => ({ ...prev, [id]: undefined }));
          if (extra.onChangeSide) extra.onChangeSide(e.target.value);
        }}
        disabled={saving}
        className={errors[id] ? 'border-red-400 focus-visible:ring-red-400' : ''}
      />
      {errors[id] ? (
        <p className="text-xs text-red-500">{errors[id]}</p>
      ) : extra.hint ? (
        <p className="text-xs text-slate-500">{extra.hint}</p>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4 mx-auto">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center">
            Help us personalize your experience. You can always update this later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'First Name', firstName, setFirstName, 'Jane')}
            {field('lastName', 'Last Name', lastName, setLastName, 'Doe')}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Jane Doe"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setDisplayNameTouched(true);
                if (errors.displayName) setErrors(prev => ({ ...prev, displayName: undefined }));
              }}
              disabled={saving}
              className={errors.displayName ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {errors.displayName ? (
              <p className="text-xs text-red-500">{errors.displayName}</p>
            ) : (
              <p className="text-xs text-slate-500">This name appears in your profile tabs</p>
            )}
          </div>

          {field('phone', 'Phone Number', phone, setPhone, '+1 (555) 000-0000', {
            type: 'tel',
            hint: 'Used for account recovery and notifications',
          })}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
