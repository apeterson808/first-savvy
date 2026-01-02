import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiCategorizeTransaction } from '@/api/functions';

function extractMerchantName(description) {
  if (!description) return '';

  let merchant = description.toUpperCase().trim();

  merchant = merchant.replace(/\s*#\d+\s*/g, ' ');
  merchant = merchant.replace(/\s*CARD\s*\d+\s*/g, ' ');
  merchant = merchant.replace(/\s*X+\d+\s*/g, ' ');
  merchant = merchant.replace(/\s+\d{2}\/\d{2}\s*/g, ' ');
  merchant = merchant.replace(/\s*\d{4,}\s*/g, ' ');
  merchant = merchant.replace(/\s*POS\s*/gi, ' ');
  merchant = merchant.replace(/\s*DEBIT\s*/gi, ' ');
  merchant = merchant.replace(/\s*PURCHASE\s*/gi, ' ');
  merchant = merchant.replace(/\s*AUTH\s*/gi, ' ');
  merchant = merchant.replace(/\s*TXN\s*/gi, ' ');
  merchant = merchant.replace(/\s*PMT\s*/gi, ' ');
  merchant = merchant.replace(/\s*ACH\s*/gi, ' ');
  merchant = merchant.replace(/\s*DDA\s*/gi, ' ');
  merchant = merchant.replace(/,\s*[A-Z]{2}\s*\d{5}/gi, '');
  merchant = merchant.replace(/\s+[A-Z]{2}\s+\d{5}/gi, '');
  merchant = merchant.replace(/\s+[A-Z]{2}\s*$/gi, '');

  const commonPrefixes = ['SQ *', 'SQ*', 'TST*', 'SPT*', 'AMZN MKTP', 'AMZN', 'PP*', 'PAYPAL *'];
  for (const prefix of commonPrefixes) {
    if (merchant.startsWith(prefix)) {
      merchant = merchant.substring(prefix.length).trim();
      break;
    }
  }

  merchant = merchant.replace(/\s+/g, ' ').trim();

  return merchant;
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  let matchingWords = 0;
  for (const word1 of words1) {
    if (word1.length <= 2) continue;
    for (const word2 of words2) {
      if (word2.length <= 2) continue;
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }

  const maxWords = Math.max(words1.length, words2.length);
  return maxWords > 0 ? matchingWords / maxWords : 0;
}

export async function suggestCategory(description, transactions, rules, amount = null, chartAccounts = []) {
  if (!description || description.length < 2) return null;

  const descLower = description.toLowerCase().trim();
  const merchantName = extractMerchantName(description);

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
    const accountMatches = new Map();

    const recentTransactions = transactions
      .filter(t => t.original_description && t.chart_account_id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 500);

    for (const t of recentTransactions) {
      const chartAccount = chartAccounts.find(c => c.id === t.chart_account_id);
      if (!chartAccount) continue;

      const tMerchant = extractMerchantName(t.original_description);
      const similarity = calculateSimilarity(merchantName, tMerchant);

      if (similarity >= 0.6) {
        const key = `${chartAccount.id}|${chartAccount.display_name || chartAccount.account_detail}|${t.type}`;

        const existing = accountMatches.get(key) || { count: 0, totalSimilarity: 0, chartAccount, type: t.type };
        existing.count++;
        existing.totalSimilarity += similarity;
        accountMatches.set(key, existing);
      }
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [key, match] of accountMatches.entries()) {
      const recency = Math.min(match.count, 10) / 10;
      const avgSimilarity = match.totalSimilarity / match.count;
      const score = (match.count * avgSimilarity * recency);

      if (score > bestScore) {
        bestScore = score;
        const [chartAccountId, category, type] = key.split('|');
        bestMatch = {
          chartAccountId,
          category,
          type,
          confidence: 'history',
          matchCount: match.count,
          similarity: avgSimilarity
        };
      }
    }

    if (bestMatch && bestScore >= 0.6) {
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

  const isAI = suggestion.confidence === 'ai' || suggestion.confidence === 'ai-cached' || suggestion.confidence === 'pattern' || suggestion.confidence === 'fallback';

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
        {suggestion.confidence === 'ai-cached' && (
          <span className="text-emerald-600 ml-1">(AI ⚡)</span>
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