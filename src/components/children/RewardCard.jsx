import React, { useState } from 'react';
import { Star, Lock, Gift, Check, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { getIconComponent } from '@/components/utils/iconMapper';

export function RewardCard({
  reward,
  starBalance,
  onRedeem,
  isRedeemed = false
}) {
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);

  const canAfford = starBalance >= reward.star_cost;
  const progress = Math.min((starBalance / reward.star_cost) * 100, 100);
  const starsNeeded = Math.max(reward.star_cost - starBalance, 0);

  const IconComponent = reward.icon ? getIconComponent(reward.icon) : Gift;

  const handleRedeemClick = () => {
    if (canAfford && !isRedeemed) {
      setShowRedeemDialog(true);
    }
  };

  const handleConfirmRedeem = () => {
    onRedeem(reward.id);
    setShowRedeemDialog(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={canAfford && !isRedeemed ? { scale: 1.02 } : {}}
      >
        <Card
          className={`border-2 transition-all ${
            isRedeemed
              ? 'border-green-300 bg-green-50/50 opacity-75'
              : canAfford
              ? 'border-purple-400 shadow-lg shadow-purple-200 hover:shadow-xl'
              : 'border-slate-300 opacity-60'
          }`}
          style={{
            filter: !canAfford && !isRedeemed ? 'grayscale(70%)' : 'none',
          }}
        >
          <CardContent className="pt-6">
            {reward.image_url && (
              <div className="mb-4 rounded-lg overflow-hidden h-32 bg-slate-100 relative">
                <img
                  src={reward.image_url}
                  alt={reward.title}
                  className="w-full h-full object-cover"
                />
                {!canAfford && !isRedeemed && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Lock className="w-12 h-12 text-white" />
                  </div>
                )}
                {isRedeemed && (
                  <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                    <Check className="w-12 h-12 text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: reward.color ? `${reward.color}20` : '#F3E8FF',
                  }}
                >
                  <IconComponent
                    className="w-6 h-6"
                    style={{ color: reward.color || '#A855F7' }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-slate-900">{reward.title}</h3>
                  {reward.description && (
                    <p className="text-sm text-slate-600 mt-1">{reward.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-purple-600 font-bold text-xl">
                <Star className="w-6 h-6 fill-purple-500" />
                {reward.star_cost}
              </div>
            </div>

            {!isRedeemed && (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {canAfford ? 'You can get this!' : `Need ${starsNeeded} more stars`}
                    </span>
                    <span className="text-sm text-slate-500">
                      {starBalance} / {reward.star_cost}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <Button
                  onClick={handleRedeemClick}
                  disabled={!canAfford}
                  className={`w-full ${
                    canAfford
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                      : 'bg-slate-300'
                  }`}
                >
                  {canAfford ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Redeem Now
                    </>
                  ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Locked
                      </>
                    )}
                </Button>
              </>
            )}

            {isRedeemed && (
              <div className="flex items-center justify-center gap-2 py-2 bg-green-100 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">Redeemed!</span>
                {reward.redeemed_at && (
                  <span className="text-sm text-green-600">
                    on {new Date(reward.redeemed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {reward.stock_quantity !== null && reward.stock_quantity > 0 && (
              <Badge variant="outline" className="mt-2">
                {reward.stock_quantity} left
              </Badge>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              Redeem Reward?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to redeem{' '}
              <span className="font-semibold text-slate-900">{reward.title}</span> for{' '}
              <span className="font-bold text-purple-600">{reward.star_cost} stars</span>?
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-900">
                  You currently have: <span className="font-bold">{starBalance} stars</span>
                </p>
                <p className="text-sm text-purple-900">
                  After redemption: <span className="font-bold">{starBalance - reward.star_cost} stars</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRedeem}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Gift className="w-4 h-4 mr-2" />
              Redeem Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
