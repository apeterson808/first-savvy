import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Lock, AlertCircle } from 'lucide-react';
import ChildAvatar from './ChildAvatar';
import PinVerificationDialog from './PinVerificationDialog';

export default function ChildProfileSelector() {
  const [childProfiles, setChildProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();

  useEffect(() => {
    if (!user) {
      navigate('/Login');
      return;
    }
    loadChildProfiles();
  }, [user, activeProfile]);

  const loadChildProfiles = async () => {
    try {
      setLoading(true);
      setError('');

      if (!activeProfile?.id) {
        setError('No profile selected. Please try again.');
        setLoading(false);
        return;
      }

      const profiles = await childProfilesAPI.getChildProfiles(activeProfile.id);

      const loginEnabledProfiles = profiles.filter(p => p.login_enabled && p.is_active);
      setChildProfiles(loginEnabledProfiles);
    } catch (err) {
      console.error('Error loading child profiles:', err);
      setError('Failed to load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = (child) => {
    if (child.account_locked) {
      setError('This account is locked. Please unlock it from Settings.');
      return;
    }
    setSelectedChild(child);
    setShowPinDialog(true);
  };

  const handlePinVerified = (childProfile) => {
    sessionStorage.setItem('viewingChildProfile', JSON.stringify({
      childProfileId: childProfile.id,
      profileId: childProfile.parent_profile_id || childProfile.owned_by_profile_id,
      childName: childProfile.child_name,
      display_name: childProfile.display_name,
      loginType: 'parent-selected',
      parentUserId: user.id
    }));

    navigate('/Dashboard');
  };

  const handleBackToParent = () => {
    navigate('/Dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBackToParent}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Account
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Who&apos;s learning today?</h1>
          <p className="text-slate-600">Select a profile to continue</p>
        </div>

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {childProfiles.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-slate-600">No child profiles available for login.</p>
              <p className="text-sm text-slate-500">
                Create child profiles and enable login from your Settings page.
              </p>
              <Button onClick={() => navigate('/Settings')}>
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {childProfiles.map((child) => (
              <button
                key={child.id}
                onClick={() => handleProfileSelect(child)}
                className="group relative"
                disabled={child.account_locked}
              >
                <Card className="hover:shadow-xl transition-all duration-200 border-2 hover:border-primary group-hover:scale-105">
                  <CardContent className="p-6 flex flex-col items-center space-y-4">
                    <div className="relative">
                      <ChildAvatar
                        child={child}
                        size="lg"
                        className={child.account_locked ? 'opacity-50' : ''}
                      />
                      {child.account_locked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="font-semibold text-lg text-slate-900">
                        {child.display_name || child.child_name}
                      </h3>
                      {child.age && (
                        <p className="text-sm text-slate-500">Age {child.age}</p>
                      )}
                      {child.account_locked && (
                        <p className="text-xs text-red-600 font-medium">Locked</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      {showPinDialog && selectedChild && (
        <PinVerificationDialog
          child={selectedChild}
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          onSuccess={handlePinVerified}
        />
      )}
    </div>
  );
}
