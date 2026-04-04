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
import { getIconComponent } from '@/components/utils/iconMapper';

export function TaskCard({
  task,
  completion,
  onComplete,
  onApprove,
  onReject,
  isParentViewing = false
}) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const isPending = completion?.status === 'pending';
  const isApproved = completion?.status === 'approved';
  const isRejected = completion?.status === 'rejected';

  const IconComponent = task.icon ? getIconComponent(task.icon) : Star;

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
    if (isPending) return 'border-yellow-400 shadow-yellow-200';
    if (isApproved) return 'border-green-400 shadow-green-200';
    if (isRejected) return 'border-red-400 shadow-red-200';
    return 'border-blue-400 shadow-blue-200';
  };

  const getStatusBadge = () => {
    if (isPending) {
      return (
        <Badge className="bg-yellow-500 text-white">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    }
    if (isApproved) {
      return (
        <Badge className="bg-green-500 text-white">
          <Check className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    }
    if (isRejected) {
      return (
        <Badge className="bg-red-500 text-white">
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
          className={`border-2 ${getBorderColor()} transition-all hover:shadow-lg ${
            isPending ? 'animate-pulse' : ''
          } ${!isPending && !isApproved && !isRejected && !isParentViewing ? 'cursor-pointer hover:border-blue-400' : ''}`}
          style={{ borderColor: task.color || undefined }}
          onClick={() => {
            if (!isPending && !isApproved && !isRejected && !isParentViewing) {
              handleCompleteClick();
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: task.color ? `${task.color}20` : '#EFF6FF' }}
                >
                  <IconComponent
                    className="w-6 h-6"
                    style={{ color: task.color || '#3B82F6' }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-slate-900">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                  )}
                  {completion?.submission_notes && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <p className="font-medium text-blue-900">Notes:</p>
                      <p className="text-blue-700">{completion.submission_notes}</p>
                    </div>
                  )}
                  {completion?.review_notes && (
                    <div className="mt-2 p-2 bg-purple-50 rounded text-sm">
                      <p className="font-medium text-purple-900">Parent's Feedback:</p>
                      <p className="text-purple-700">{completion.review_notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge()}
                <div className="flex items-center gap-1 text-yellow-600 font-bold text-lg">
                  <Star className="w-5 h-5 fill-yellow-500" />
                  {task.star_reward || 1}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {!isPending && !isApproved && !isRejected && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteClick();
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
                  size="lg"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Complete Task
                </Button>
              )}

              {isPending && isParentViewing && (
                <>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveClick();
                    }}
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>
              Add any notes about how you completed this task (optional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Tell your parent what you did..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete}>
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
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
