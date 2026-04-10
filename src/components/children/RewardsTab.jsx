import { useState, useEffect } from 'react';
import { rewardsAPI } from '@/api/rewards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Award, Star } from 'lucide-react';
import { toast } from 'sonner';
import { RewardDialog } from './RewardDialog';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

export function RewardsTab({ childId, child, profileId, onUpdate }) {
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);

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
      const [rewardsData, redemptionsData] = await Promise.all([
        rewardsAPI.getRewards(profileId),
        rewardsAPI.getRedemptions(childId),
      ]);
      setRewards(rewardsData || []);
      setRedemptions(redemptionsData || []);
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
    if (onUpdate) {
      onUpdate();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Reward Catalog</h3>
          <Button size="sm" onClick={() => setIsRewardDialogOpen(true)}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rewards.map((reward) => {
              const IconComp = PICKER_ICON_MAP[reward.icon] || PICKER_ICON_MAP['Gift'];
              return (
                <Card key={reward.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-center py-5"
                    style={{ backgroundColor: reward.color || '#EFCE7B' }}
                  >
                    <IconComp className="w-8 h-8 text-white" />
                  </div>
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm leading-tight truncate">{reward.title}</p>
                    {reward.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{reward.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-semibold text-amber-600">{reward.star_cost}</span>
                    </div>
                    {reward.stock_quantity !== null && (
                      <Badge variant="outline" className="mt-1.5 text-xs px-1.5 py-0">
                        {reward.stock_quantity} left
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Redemptions</h3>
        {redemptions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-slate-600 py-4">No redemptions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {redemptions.slice(0, 5).map((redemption) => (
              <Card key={redemption.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{redemption.rewards?.title}</p>
                      <p className="text-sm text-slate-600">
                        {new Date(redemption.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={
                      redemption.status === 'fulfilled' ? 'default' :
                      redemption.status === 'approved' ? 'secondary' :
                      redemption.status === 'pending' ? 'outline' :
                      'destructive'
                    }>
                      {redemption.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RewardDialog
        isOpen={isRewardDialogOpen}
        onClose={() => setIsRewardDialogOpen(false)}
        profileId={profileId}
        childId={childId}
        onSuccess={handleRewardSuccess}
      />
    </div>
  );
}
