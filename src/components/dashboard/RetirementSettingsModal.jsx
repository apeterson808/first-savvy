import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2, Settings2, AlertCircle } from 'lucide-react';
import { getRetirementSettings, upsertRetirementSettings } from '@/api/retirementSettings';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const SPENDING_STYLES = [
  { key: 'thrifty', label: 'Thrifty', multiplier: 0.7, description: 'Lean budget, minimal extras' },
  { key: 'moderate', label: 'Moderate', multiplier: 1.0, description: 'Comfortable, some luxuries' },
  { key: 'spendy', label: 'Spendy', multiplier: 1.5, description: 'Generous lifestyle' },
];

function formatM(val) {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function RetirementSettingsModal({ open, onClose, dateOfBirth, currentNetWorth, avgMonthlySavings }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [retirementAge, setRetirementAge] = useState(65);
  const [monthlySavings, setMonthlySavings] = useState(avgMonthlySavings || 2000);
  const [baseMonthlySpending, setBaseMonthlySpending] = useState(5000);
  const [spendingStyle, setSpendingStyle] = useState('moderate');
  const [growthRate, setGrowthRate] = useState(7);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    getRetirementSettings(user.id)
      .then(s => {
        if (s) {
          setRetirementAge(s.retirement_age ?? 65);
          setMonthlySavings(s.monthly_savings ?? avgMonthlySavings ?? 2000);
          setBaseMonthlySpending(s.monthly_retirement_spending ?? 5000);
          setSpendingStyle(s.spending_style ?? 'moderate');
          setGrowthRate(Math.round((s.assumed_growth_rate ?? 0.07) * 100));
        } else if (avgMonthlySavings) {
          setMonthlySavings(avgMonthlySavings);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, user?.id]);

  const currentAge = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const styleMultiplier = SPENDING_STYLES.find(s => s.key === spendingStyle)?.multiplier ?? 1;
  const monthlyRetirementSpend = baseMonthlySpending * styleMultiplier;

  // Project future net worth at retirement
  const yearsToRetirement = currentAge != null ? Math.max(0, retirementAge - currentAge) : 30;
  const monthlyRate = growthRate / 100 / 12;
  const months = yearsToRetirement * 12;
  const projectedAtRetirement = months > 0
    ? currentNetWorth * Math.pow(1 + monthlyRate, months) +
      monthlySavings * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    : currentNetWorth;

  // What you'll need: present value of 25 years of retirement spending (Rule of 25 / 4% withdrawal)
  const retirementYears = 90 - retirementAge;
  const neededAtRetirement = retirementYears > 0
    ? monthlyRetirementSpend * 12 * ((1 - Math.pow(1 + growthRate / 100, -retirementYears)) / (growthRate / 100))
    : monthlyRetirementSpend * 12 * 25;

  const onTrack = projectedAtRetirement >= neededAtRetirement;
  const gap = Math.abs(projectedAtRetirement - neededAtRetirement);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await upsertRetirementSettings(user.id, {
        retirement_age: retirementAge,
        monthly_savings: monthlySavings,
        monthly_retirement_spending: baseMonthlySpending,
        assumed_growth_rate: growthRate / 100,
        spending_style: spendingStyle,
      });
      toast.success('Retirement settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const noDob = !dateOfBirth;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-600" />
            Retirement Projection
          </DialogTitle>
        </DialogHeader>

        {noDob ? (
          <div className="py-6 text-center space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mx-auto">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Date of birth required</p>
              <p className="text-sm text-slate-500 mt-1">
                Add your date of birth in Profile Settings to enable retirement projections.
              </p>
            </div>
            <Button onClick={() => { onClose(); navigate('/Settings'); }}>Go to Profile Settings</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Retiring at age {retirementAge}
                {currentAge != null && ` — ${yearsToRetirement} year${yearsToRetirement !== 1 ? 's' : ''} away`}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div>
                  <span className="text-sm text-slate-600">You'll have </span>
                  <span className={`text-xl font-bold ${onTrack ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {formatM(projectedAtRetirement)}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 mt-1 shrink-0" />
                <div>
                  <span className="text-sm text-slate-600">You'll need </span>
                  <span className={`text-xl font-bold ${!onTrack ? 'text-red-500' : 'text-slate-800'}`}>
                    {formatM(neededAtRetirement)}
                  </span>
                </div>
              </div>
              {onTrack ? (
                <p className="text-xs text-emerald-600 font-medium pt-1">
                  On track — surplus of {formatM(gap)} at retirement
                </p>
              ) : (
                <p className="text-xs text-red-500 font-medium pt-1">
                  Shortfall of {formatM(gap)} — adjust savings or retirement age
                </p>
              )}
            </div>

            {/* Retirement Age */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Target Retirement Age</Label>
                <span className="text-lg font-bold text-slate-800">{retirementAge}</span>
              </div>
              <Slider
                min={40}
                max={85}
                step={1}
                value={[retirementAge]}
                onValueChange={([v]) => setRetirementAge(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>Age 40</span>
                <span>Age 65</span>
                <span>Age 85</span>
              </div>
            </div>

            {/* Monthly Savings */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Monthly Savings</Label>
                <span className="text-lg font-bold text-slate-800">${monthlySavings.toLocaleString()}</span>
              </div>
              <Slider
                min={0}
                max={20000}
                step={100}
                value={[monthlySavings]}
                onValueChange={([v]) => setMonthlySavings(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>$0</span>
                <span>$10K</span>
                <span>$20K</span>
              </div>
            </div>

            {/* Retirement Spending */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Monthly Retirement Spending</Label>
                <span className="text-lg font-bold text-slate-800">${Math.round(monthlyRetirementSpend).toLocaleString()}/mo</span>
              </div>
              <Slider
                min={1000}
                max={30000}
                step={250}
                value={[baseMonthlySpending]}
                onValueChange={([v]) => setBaseMonthlySpending(v)}
                className="w-full"
              />
              <div className="grid grid-cols-3 gap-2 pt-1">
                {SPENDING_STYLES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSpendingStyle(s.key)}
                    className={`py-2 px-3 rounded-lg border text-center transition-colors ${
                      spendingStyle === s.key
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-medium">{s.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.multiplier === 1 ? 'base' : `×${s.multiplier}`}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced */}
            <div>
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced settings
              </button>
              {showAdvanced && (
                <div className="space-y-3 pt-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Assumed Annual Growth Rate</Label>
                    <span className="text-lg font-bold text-slate-800">{growthRate}%</span>
                  </div>
                  <Slider
                    min={1}
                    max={15}
                    step={0.5}
                    value={[growthRate]}
                    onValueChange={([v]) => setGrowthRate(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>1% (conservative)</span>
                    <span>7% (historical avg)</span>
                    <span>15%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save & Update Chart'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
