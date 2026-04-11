import { useState } from 'react';
import { Star, Sparkles, Minus, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PICKER_ICON_MAP } from '@/components/common/AppearancePicker';

export function AwardStarsDialog({ open, onOpenChange, onAward, task = null, childName = '' }) {
  const [stars, setStars] = useState(task?.star_reward || 1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (val) => {
    if (!val) {
      setStars(task?.star_reward || 1);
      setNote('');
    }
    onOpenChange(val);
  };

  const handleAward = async () => {
    setLoading(true);
    try {
      await onAward(stars, note || null);
      handleOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const TaskIcon = task?.icon ? (PICKER_ICON_MAP[task.icon] || Star) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            {task ? 'Award Stars for Task' : 'Award One-Time Stars'}
          </DialogTitle>
          <DialogDescription>
            {task
              ? `Award stars to ${childName} for completing "${task.title}"`
              : `Award stars to ${childName} for something special`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {task && TaskIcon && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: task.color || '#52A5CE' }}
              >
                <TaskIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-sm text-slate-800">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-slate-500">{task.description}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Stars to award</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setStars(Math.max(1, stars - 1))}
                disabled={stars <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 min-w-[60px] justify-center">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-2xl font-bold text-slate-800">{stars}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setStars(Math.min(50, stars + 1))}
                disabled={stars >= 50}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {task ? 'Feedback (optional)' : 'What did they do? (optional)'}
            </Label>
            <Textarea
              placeholder={task ? 'Great job! Keep it up...' : 'Describe what they did to earn these stars...'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAward}
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold"
          >
            <Star className="w-4 h-4 mr-2 fill-slate-900" />
            Award {stars} {stars === 1 ? 'Star' : 'Stars'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
