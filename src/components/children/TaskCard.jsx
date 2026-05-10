import React, { useState } from 'react';
import { Star, Sparkles, Clock, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';
import { getIconComponent } from '@/components/utils/iconMapper';

function formatShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function TaskCard({
  task,
  lastCompletion,
  onComplete,
  isParentView = false,
  locked = false,
}) {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [notes, setNotes] = useState('');

  const IconComponent = task.icon ? (PICKER_ICON_MAP[task.icon] || getIconComponent(task.icon)) : Star;

  const handleConfirmComplete = () => {
    onComplete(task.id, notes);
    setShowCompleteDialog(false);
    setNotes('');
  };

  const lastRequested = lastCompletion?.submitted_at;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={`border-2 transition-all ${locked ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:shadow-lg cursor-pointer hover:border-blue-400'}`}
          style={{ borderColor: locked ? '#CBD5E1' : (task.color || undefined) }}
          onClick={() => {
            if (!isParentView && !locked) setShowCompleteDialog(true);
          }}
        >
          <CardContent className="pt-4 sm:pt-5 px-4 sm:px-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                <div
                  className="p-2 sm:p-2.5 rounded-lg shrink-0"
                  style={{ backgroundColor: task.color || '#3B82F6' }}
                >
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg text-slate-900 break-words leading-tight">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 break-words">{task.description}</p>
                  )}
                  {lastRequested && (
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      Last requested: {formatShort(lastRequested)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {locked ? (
                  <div className={`flex items-center gap-1 font-medium text-sm ${lastCompletion?.status === 'pending' ? 'text-amber-500' : 'text-slate-400'}`}>
                    <Lock className="w-4 h-4" />
                    <span>{lastCompletion?.status === 'pending' ? 'Pending' : 'Done'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600 font-bold text-base sm:text-lg">
                    <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-500" />
                    {task.star_reward || 1}
                  </div>
                )}
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
    </>
  );
}
