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
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
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

  const IconComponent = reward.icon ? (PICKER_ICON_MAP[reward.icon] || getIconComponent(reward.icon)) : Gift;

  const handleRedeemClick = () => {
    if (canAfford && !isRedeemed) {
      setShowRedeemDialog(true);
    }
  };

  const handleConfirmRedeem = () => {
    onRedeem(reward.id);
    setShowRedeemDialog(false);
  };

  const borderClass = isRedeemed
    ? 'border-green-300'
    : canAfford
    ? 'border-amber-400 shadow-md shadow-amber-100'
    : 'border-slate-200';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={canAfford && !isRedeemed ? { scale: 1.02 } : {}}
      >
        <Card
          className={`border-2 transition-all ${borderClass} ${!canAfford && !isRedeemed ? 'opacity-60' : ''}`}
        >
          <CardContent className="pt-4 sm:pt-5 px-4 sm:px-5 pb-4 sm:pb-5">
            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div
                className="p-2 sm:p-3 rounded-lg shrink-0"
                style={{ backgroundColor: reward.color || '#f59e0b' }}
              >
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-tight break-words">
                    {reward.title}
                  </h3>
                  <div className="flex items-center gap-1 text-amber-500 font-bold text-base sm:text-lg shrink-0">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" />
                    {reward.star_cost}
                  </div>
                </div>
                {reward.description && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 break-words">{reward.description}</p>
                )}
              </div>
            </div>

            {!isRedeemed && (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-600">
                      {canAfford ? 'You can get this!' : `${starsNeeded} more stars needed`}
                    </span>
                    <span className="text-xs text-slate-400">
                      {starBalance} / {reward.star_cost}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>

                <Button
                  onClick={handleRedeemClick}
                  disabled={!canAfford}
                  size="sm"
                  className={`w-full text-sm ${
                    canAfford
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {canAfford ? (
                    <>
                      <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Redeem Now
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Locked
                    </>
                  )}
                </Button>
              </>
            )}

            {isRedeemed && (
              <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg border border-green-200">
                <Check className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-700 text-sm">Redeemed!</span>
                {reward.redeemed_at && (
                  <span className="text-xs text-green-500">
                    {new Date(reward.redeemed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {reward.stock_quantity !== null && reward.stock_quantity > 0 && (
              <Badge variant="outline" className="mt-2 text-xs">
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
              <Sparkles className="w-5 h-5 text-amber-500" />
              Redeem Reward?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to redeem{' '}
              <span className="font-semibold text-slate-900">{reward.title}</span> for{' '}
              <span className="font-bold text-amber-600">{reward.star_cost} stars</span>?
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-900">
                  You currently have: <span className="font-bold">{starBalance} stars</span>
                </p>
                <p className="text-sm text-amber-900">
                  After redemption: <span className="font-bold">{starBalance - reward.star_cost} stars</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRedeem}
              className="bg-amber-500 hover:bg-amber-600 text-white"
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
