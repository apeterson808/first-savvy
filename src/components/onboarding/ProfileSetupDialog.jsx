import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Users, Search, CheckCircle, ArrowRight } from 'lucide-react';
import { Loader2 as LoaderIcon } from 'lucide-react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';

export default function ProfileSetupDialog({ open, onClose, currentFullName = '', currentDisplayName = 'Personal' }) {
  const { refreshHouseholdStatus } = useProfile();
  const [step, setStep] = useState(1);

  // Step 1 — profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Step 2 — household connection
  const [connectChoice, setConnectChoice] = useState(null); // null | 'yes' | 'no'
  const [connectEmail, setConnectEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null); // null | 'not_found' | { user_id, email, display_name }
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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
    if (!dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    return e;
  };

  const handleSaveProfile = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    try {
      const userId = (await firstsavvy.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const fullName = [firstName.trim(), lastName.trim()].join(' ');

      await firstsavvy
        .from('user_settings')
        .upsert({
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          display_name: displayName.trim(),
          phone: phone.trim(),
          ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
        }, { onConflict: 'id' });

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

      setStep(2);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!connectEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(connectEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSearching(true);
    setSearchResult(null);
    try {
      const { data, error } = await supabase.rpc('find_user_by_email', { p_email: connectEmail.trim().toLowerCase() });
      if (error) throw error;
      setSearchResult(!data || data.length === 0 ? 'not_found' : data[0]);
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || searchResult === 'not_found') return;
    setConnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: result, error: rpcErr } = await supabase.rpc('request_join_household', {
        p_owner_user_id: searchResult.user_id,
        p_requester_display_name: displayName.trim() || firstName.trim(),
      });

      if (rpcErr) throw rpcErr;

      if (result?.already_member) {
        toast.success('You are already connected to this household');
        onClose();
      } else {
        setRequestSent(true);
        // Refresh profile context so the pending screen shows immediately
        setTimeout(() => refreshHouseholdStatus(), 500);
      }
    } catch {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSkip = () => {
    onClose();
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

        {step === 1 && (
          <>
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

              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">
                  Date of Birth <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    if (errors.dateOfBirth) setErrors(prev => ({ ...prev, dateOfBirth: undefined }));
                  }}
                  disabled={saving}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  className={errors.dateOfBirth ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {errors.dateOfBirth ? (
                  <p className="text-xs text-red-500">{errors.dateOfBirth}</p>
                ) : (
                  <p className="text-xs text-slate-500">Used to personalize your financial projections</p>
                )}
              </div>

              {field('phone', 'Phone Number', phone, setPhone, '+1 (555) 000-0000', {
                type: 'tel',
                hint: 'Used for account recovery and notifications',
              })}
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                {saving ? 'Saving...' : (
                  <span className="flex items-center gap-2">
                    Continue <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400">Step 1 of 2</p>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 mb-4 mx-auto">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
              <DialogTitle className="text-center text-xl">Joining a Household?</DialogTitle>
              <DialogDescription className="text-center">
                Request to join an existing household. The account owner will be notified to approve you.
              </DialogDescription>
            </DialogHeader>

            {requestSent ? (
              <div className="space-y-4 pt-2 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Request sent!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-medium">{searchResult?.display_name || searchResult?.email}</span> will be notified and can approve your request. You'll get full access once they accept.
                  </p>
                </div>
                <Button className="w-full" onClick={() => { onClose(); refreshHouseholdStatus(); }}>Done</Button>
              </div>
            ) : (
              <>
                {connectChoice === null && (
                  <div className="space-y-3 pt-2">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex flex-col items-center gap-1 border-2 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                      onClick={() => setConnectChoice('yes')}
                    >
                      <span className="font-semibold text-slate-800">Yes, request to join a household</span>
                      <span className="text-xs text-slate-500 font-normal">Send a request to someone already on First Savvy</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex flex-col items-center gap-1 hover:bg-slate-50 transition-colors"
                      onClick={handleSkip}
                    >
                      <span className="font-semibold text-slate-800">No, I'm starting fresh</span>
                      <span className="text-xs text-slate-500 font-normal">Set up my own independent account</span>
                    </Button>
                  </div>
                )}

                {connectChoice === 'yes' && (
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-slate-600 text-center">
                      Enter the email of the household owner you want to join.
                    </p>

                    <form onSubmit={handleSearchUser} className="flex gap-2">
                      <Input
                        type="email"
                        value={connectEmail}
                        onChange={(e) => { setConnectEmail(e.target.value); setSearchResult(null); }}
                        placeholder="their@email.com"
                        disabled={searching || connecting}
                        className="flex-1"
                        autoFocus
                      />
                      <Button type="submit" variant="outline" disabled={searching || !connectEmail.trim() || connecting}>
                        {searching ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </form>

                    {searchResult === 'not_found' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                        No account found with that email. Make sure they have a First Savvy account.
                      </div>
                    )}

                    {searchResult && searchResult !== 'not_found' && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                            {(searchResult.display_name || searchResult.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{searchResult.display_name || searchResult.email}</p>
                            <p className="text-xs text-slate-500 truncate">{searchResult.email}</p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
                        </div>
                        <div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800">
                          Your request will be sent for approval. They choose your role (e.g. Spouse, View-only).
                        </div>
                        <Button className="w-full" onClick={handleSendRequest} disabled={connecting}>
                          {connecting ? <><LoaderIcon className="w-4 h-4 animate-spin mr-2" />Sending...</> : 'Send join request'}
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      className="w-full text-slate-500 text-sm"
                      onClick={() => { setConnectChoice(null); setConnectEmail(''); setSearchResult(null); }}
                      disabled={connecting}
                    >
                      Back
                    </Button>
                  </div>
                )}
              </>
            )}

            {!requestSent && <p className="text-center text-xs text-slate-400">Step 2 of 2</p>}
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
