import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiCategorizeTransaction } from '@/api/functions';

export async function suggestCategory(description, transactions, rules, amount = null, chartAccounts = []) {
  if (!description || description.length < 2) return null;

  const descLower = description.toLowerCase().trim();

  if (rules && rules.length > 0) {
    const activeRules = rules
      .filter(r => r.is_active)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of activeRules) {
      const matchVal = rule.match_value.toLowerCase();
      let matches = false;

      switch (rule.match_type) {
        case 'exact':
          matches = descLower === matchVal;
          break;
        case 'starts_with':
          matches = descLower.startsWith(matchVal);
          break;
        case 'ends_with':
          matches = descLower.endsWith(matchVal);
          break;
        case 'contains':
        default:
          matches = descLower.includes(matchVal);
          break;
      }

      if (matches) {
        return {
          chartAccountId: rule.chart_account_id,
          category: rule.category,
          type: rule.transaction_type,
          confidence: 'rule',
          ruleName: rule.name
        };
      }
    }
  }

  if (transactions && transactions.length > 0 && chartAccounts.length > 0) {
    const accountCount = {};

    transactions.forEach(t => {
      if (!t.original_description || !t.chart_account_id) return;

      const chartAccount = chartAccounts.find(c => c.id === t.chart_account_id);
      if (!chartAccount) return;

      const tDescLower = t.original_description.toLowerCase();

      if (tDescLower.includes(descLower) || descLower.includes(tDescLower) ||
          (descLower.length > 4 && tDescLower.includes(descLower.substring(0, 4)))) {
        const displayName = chartAccount.display_name || chartAccount.account_detail || 'Other';
        const key = `${chartAccount.id}|${displayName}|${t.type}`;
        accountCount[key] = (accountCount[key] || 0) + 1;
      }
    });

    let maxCount = 0;
    let bestMatch = null;

    Object.entries(accountCount).forEach(([key, count]) => {
      if (count > maxCount) {
        maxCount = count;
        const [chartAccountId, category, type] = key.split('|');
        bestMatch = { chartAccountId, category, type, confidence: 'history', matchCount: count };
      }
    });

    if (bestMatch && maxCount >= 1) {
      return bestMatch;
    }
  }

  try {
    const aiResult = await aiCategorizeTransaction({ description, amount });
    if (aiResult && (aiResult.chartAccountId || aiResult.category)) {
      return {
        chartAccountId: aiResult.chartAccountId,
        category: aiResult.category,
        type: aiResult.type,
        confidence: aiResult.confidence || 'ai'
      };
    }
  } catch (error) {
    console.error('AI categorization failed:', error);
  }

  return null;
}

export default function CategorySuggestion({ suggestion, onApply }) {
  if (!suggestion) return null;

  const isAI = suggestion.confidence === 'ai' || suggestion.confidence === 'pattern' || suggestion.confidence === 'fallback';

  return (
    <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
      isAI ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
    }`}>
      {isAI ? <Zap className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      <span>
        Suggested: <span className="font-medium capitalize">{(suggestion.category || '').replace(/_/g, ' ')}</span>
        {suggestion.confidence === 'rule' && (
          <span className="text-blue-500 ml-1">(rule: {suggestion.ruleName})</span>
        )}
        {suggestion.confidence === 'history' && (
          <span className="text-blue-500 ml-1">({suggestion.matchCount} similar)</span>
        )}
        {suggestion.confidence === 'ai' && (
          <span className="text-emerald-600 ml-1">(AI)</span>
        )}
        {suggestion.confidence === 'pattern' && (
          <span className="text-emerald-600 ml-1">(Smart Match)</span>
        )}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={`h-5 px-2 text-xs ${
          isAI ? 'text-emerald-700 hover:bg-emerald-100' : 'text-blue-700 hover:bg-blue-100'
        }`}
        onClick={() => onApply(suggestion)}
      >
        Apply
      </Button>
    </div>
  );
}