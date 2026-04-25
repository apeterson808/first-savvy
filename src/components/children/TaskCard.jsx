import React, { useState } from 'react';
import { Star, Check, X, Clock, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { getIconComponent } from '@/components/utils/iconMapper';

export function TaskCard({
  task,
  completion,
  onComplete,
  onApprove,
  onReject,
  isParentView = false
}) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const isPending = completion?.status === 'pending';
  const isApproved = completion?.status === 'approved';
  const isRejected = completion?.status === 'rejected';

  const showCompletion = isPending;

  const IconComponent = task.icon ? (PICKER_ICON_MAP[task.icon] || getIconComponent(task.icon)) : Star;

  const handleCompleteClick = () => {
    setShowCompleteDialog(true);
  };

  const handleConfirmComplete = () => {
    onComplete(task.id, notes);
    setShowCompleteDialog(false);
    setNotes('');
  };

  const handleApproveClick = () => {
    setShowReviewDialog(true);
  };

  const handleConfirmApprove = () => {
    onApprove(completion.id, reviewNotes);
    setShowReviewDialog(false);
    setReviewNotes('');
  };

  const handleConfirmReject = () => {
    onReject(completion.id, reviewNotes);
    setShowReviewDialog(false);
    setReviewNotes('');
  };

  const getBorderColor = () => {
    if (isPending && showCompletion) return 'border-yellow-400 shadow-yellow-200';
    if (isApproved && showCompletion) return 'border-green-400 shadow-green-200';
    if (isRejected && showCompletion) return 'border-red-400 shadow-red-200';
    return 'border-blue-400 shadow-blue-200';
  };

  const getStatusBadge = () => {
    if (isPending && showCompletion) {
      return (
        <Badge className="!bg-yellow-500 hover:!bg-yellow-500 !text-white !border-0 shadow-md">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    }
    if (isApproved && showCompletion) {
      return (
        <Badge className="!bg-green-500 hover:!bg-green-500 !text-white !border-0 shadow-md">
          <Check className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (isRejected && showCompletion) {
      return (
        <Badge className="!bg-red-500 hover:!bg-red-500 !text-white !border-0 shadow-md">
          <X className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={`border-2 ${getBorderColor()} transition-all hover:shadow-lg ${!showCompletion && !isParentView ? 'cursor-pointer hover:border-blue-400' : ''}`}
          style={{ borderColor: task.color || undefined }}
          onClick={() => {
            if (!showCompletion && !isParentView) {
              handleCompleteClick();
            }
          }}
        >
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                <div
                  className="p-2 sm:p-3 rounded-lg shrink-0"
                  style={{ backgroundColor: task.color || '#3B82F6' }}
                >
                  <IconComponent
                    className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                    <h3 className="font-semibold text-base sm:text-lg text-slate-900 break-words">{task.title}</h3>
                    {getStatusBadge()}
                  </div>
                  {task.description && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 break-words">{task.description}</p>
                  )}
                  {completion?.submission_notes && isParentView && isPending && (
                    <div className="mt-2 p-2 bg-blue-100 rounded text-xs sm:text-sm border border-blue-200">
                      <p className="font-medium text-blue-900">Notes from child:</p>
                      <p className="text-blue-800 mt-0.5 break-words">{completion.submission_notes}</p>
                    </div>
                  )}
                  {completion?.review_notes && showCompletion && (
                    <div className="mt-2 p-2 bg-slate-50 rounded text-xs sm:text-sm border border-slate-200">
                      <p className="font-medium text-slate-700">Parent's Feedback:</p>
                      <p className="text-slate-600 break-words">{completion.review_notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-1 text-yellow-600 font-bold text-base sm:text-lg">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-500" />
                  {task.star_reward || 1}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-sm overflow-hidden p-0">
          <div
            className="px-6 pt-6 pb-4 text-white"
            style={{ backgroundColor: task.color || '#3B82F6' }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-white/20">
                {(() => { const I = PICKER_ICON_MAP[task.icon] || Star; return <I className="w-5 h-5 text-white" />; })()}
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide">Complete Task</p>
                <h2 className="font-bold text-lg leading-tight">{task.title}</h2>
              </div>
              <div className="ml-auto flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                <span className="font-bold text-sm">{task.star_reward || 1}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-3">
            <Textarea
              placeholder="Any notes for your parent? (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowCompleteDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 font-semibold text-white"
                style={{ backgroundColor: task.color || '#3B82F6' }}
                onClick={handleConfirmComplete}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Submit for Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Review Task Completion</DialogTitle>
            <DialogDescription>
              Add feedback for your child (optional)
            </DialogDescription>
          </DialogHeader>
          {completion?.submission_notes && (
            <div className="p-3 bg-blue-50 rounded">
              <p className="font-medium text-sm text-blue-900">Child's Notes:</p>
              <p className="text-sm text-blue-700">{completion.submission_notes}</p>
            </div>
          )}
          <Textarea
            placeholder="Great job! Keep it up..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleConfirmReject}
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleConfirmApprove}
              className="bg-green-500 hover:bg-green-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Approve & Award Stars
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
