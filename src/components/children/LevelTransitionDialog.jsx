import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { childProfilesAPI } from '@/api/childProfiles';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

const LEVEL_INFO = {
  1: {
    name: 'Basic Access',
    description: 'Dashboard and chores only. Can view assigned chores and mark complete. Parent must approve all actions.',
    features: ['View dashboard', 'View chores', 'Mark chores complete (needs approval)', 'View points balance'],
  },
  2: {
    name: 'Rewards',
    description: 'Can view and redeem rewards. Can suggest chores and redeem rewards independently. Parent gets notifications.',
    features: ['All Tier 1 features', 'Suggest chores', 'Redeem rewards', 'View reward history'],
  },
  3: {
    name: 'Money',
    description: 'View accounts and budgets. Can create goals, access allowance tracking, and view financial data.',
    features: ['All Tier 2 features', 'View accounts', 'View budgets', 'Create goals', 'Allowance tracking'],
  },
};

export function LevelTransitionDialog({ open, onOpenChange, child, onLevelChanged }) {
  const { user } = useAuth();
  const [newLevel, setNewLevel] = useState(child?.current_permission_level || 1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (child) {
      setNewLevel(child.current_permission_level);
    }
  }, [child]);

  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const levelFeatures = await childProfilesAPI.getPermissionLevelFeatures(newLevel);
        setFeatures(levelFeatures);
      } catch (error) {
        console.error('Error loading features:', error);
      }
    };

    if (newLevel) {
      loadFeatures();
    }
  }, [newLevel]);

  const handleUpdateLevel = async () => {
    if (newLevel === child.current_permission_level) {
      toast.error('Please select a different level');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the level change');
      return;
    }

    try {
      setLoading(true);
      await childProfilesAPI.updateChildLevel(child.id, newLevel, user.id, reason);
      toast.success('Permission level updated successfully');
      onLevelChanged();
    } catch (error) {
      console.error('Error updating level:', error);
      toast.error('Failed to update permission level');
    } finally {
      setLoading(false);
    }
  };

  if (!child) return null;

  const isUpgrade = newLevel > child.current_permission_level;
  const isDowngrade = newLevel < child.current_permission_level;
  const levelInfo = LEVEL_INFO[newLevel];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Permission Level</DialogTitle>
          <DialogDescription>
            Change {child.child_name}'s permission level based on demonstrated responsibility
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Current Level</Label>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                Level {child.current_permission_level}: {LEVEL_INFO[child.current_permission_level].name}
              </Badge>
              {isUpgrade && <TrendingUp className="h-4 w-4 text-green-600" />}
              {isDowngrade && <AlertCircle className="h-4 w-4 text-amber-600" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newLevel">New Permission Tier</Label>
            <Select
              value={newLevel.toString()}
              onValueChange={(value) => setNewLevel(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    Tier {level} - {LEVEL_INFO[level].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {levelInfo && (
            <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Tier {newLevel}: {levelInfo.name}</h4>
                <p className="text-sm text-slate-600 mt-1">{levelInfo.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Key Features:</p>
                <ul className="space-y-1">
                  {levelInfo.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-slate-600">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {isDowngrade && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Downgrading will restrict {child.child_name}'s access to certain features. Make sure to explain the
                reasons clearly.
              </AlertDescription>
            </Alert>
          )}


          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're changing the permission level..."
              rows={3}
              required
            />
            <p className="text-sm text-slate-600">
              This will be recorded in the level transition history
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLevel}
              disabled={loading || newLevel === child.current_permission_level}
            >
              {loading ? 'Updating...' : 'Update Level'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
