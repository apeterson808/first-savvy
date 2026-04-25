import { useState, useEffect } from 'react';
import { rewardsAPI } from '@/api/rewards';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Award } from 'lucide-react';
import { toast } from 'sonner';
import { RewardDialog } from './RewardDialog';
import { RewardCard } from './RewardCard';

export function RewardsTab({ childId, child, profileId, onUpdate }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);

  useEffect(() => {
    loadRewardsData();
  }, [childId]);

  const loadRewardsData = async () => {
    if (!profileId || !childId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const rewardsData = await rewardsAPI.getRewardsByChild(childId);
      setRewards(rewardsData || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading rewards...</div>;
  }

  const handleRewardSuccess = () => {
    loadRewardsData();
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rewards</h3>
        <Button size="sm" onClick={() => { setEditingReward(null); setIsRewardDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Reward
        </Button>
      </div>

      {rewards.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Award className="mx-auto h-12 w-12 text-slate-400" />
              <p className="mt-2 text-slate-600">No rewards yet</p>
              <Button className="mt-4" size="sm" onClick={() => setIsRewardDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Reward
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              starBalance={child?.stars_balance ?? 0}
              isRedeemed={reward.status === 'redeemed'}
              onEdit={(r) => { setEditingReward(r); setIsRewardDialogOpen(true); }}
              onDelete={async (rewardId) => {
                try {
                  await rewardsAPI.deleteReward(rewardId);
                  toast.success('Reward deleted');
                  loadRewardsData();
                  if (onUpdate) onUpdate();
                } catch {
                  toast.error('Failed to delete reward');
                }
              }}
              onRedeem={async (rewardId) => {
                try {
                  await rewardsAPI.redeemReward(childId, rewardId);
                  toast.success('Reward redeemed!');
                  loadRewardsData();
                  if (onUpdate) onUpdate();
                } catch (error) {
                  toast.error(error.message || 'Failed to redeem reward');
                }
              }}
            />
          ))}
        </div>
      )}

      <RewardDialog
        isOpen={isRewardDialogOpen}
        onClose={() => { setIsRewardDialogOpen(false); setEditingReward(null); }}
        profileId={profileId}
        childId={childId}
        onSuccess={handleRewardSuccess}
        reward={editingReward}
      />
    </div>
  );
}
