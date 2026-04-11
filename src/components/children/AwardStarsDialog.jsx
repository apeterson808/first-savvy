import { useState } from 'react';
import { Star, Sparkles, Minus, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 px-6 pt-6 pb-8 relative">
          <button
            onClick={() => handleOpenChange(false)}
            className="absolute top-4 right-4 text-amber-800/60 hover:text-amber-900 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-800" />
            <h2 className="text-lg font-bold text-amber-900">
              {task ? 'Award Stars for Task' : 'Award One-Time Stars'}
            </h2>
          </div>
          <p className="text-sm text-amber-800/80">
            {task
              ? `Reward ${childName} for completing "${task.title}"`
              : `Award stars to ${childName} for something special`}
          </p>

          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setStars(Math.max(1, stars - 1))}
              disabled={stars <= 1}
              className="w-9 h-9 rounded-full bg-white/30 hover:bg-white/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-amber-900 transition-colors font-bold text-lg"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center">
              <div className="flex gap-0.5 mb-1">
                {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-white text-white drop-shadow" />
                ))}
                {stars > 5 && (
                  <span className="text-xs text-white font-bold self-end ml-1">+{stars - 5}</span>
                )}
              </div>
              <span className="text-4xl font-black text-white drop-shadow-sm leading-none">{stars}</span>
              <span className="text-xs font-semibold text-amber-800/70 mt-0.5 uppercase tracking-wide">
                {stars === 1 ? 'star' : 'stars'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setStars(Math.min(50, stars + 1))}
              disabled={stars >= 50}
              className="w-9 h-9 rounded-full bg-white/30 hover:bg-white/50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-amber-900 transition-colors font-bold text-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white px-6 pt-5 pb-6 space-y-4">
          {task && TaskIcon && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: task.color || '#52A5CE' }}
              >
                <TaskIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-slate-500">{task.description}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              {task ? 'Feedback (optional)' : 'What did they do? (optional)'}
            </label>
            <Textarea
              placeholder={task ? 'Great job! Keep it up...' : 'Describe what they did to earn these stars...'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none border-slate-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="flex-1 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAward}
              disabled={loading}
              className="flex-1 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold shadow-sm shadow-amber-200"
            >
              <Star className="w-4 h-4 mr-1.5 fill-amber-900" />
              Award {stars} {stars === 1 ? 'Star' : 'Stars'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
