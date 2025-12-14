import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function suggestCategory(description, transactions, rules) {
  if (!description || description.length < 2) return null;
  
  const descLower = description.toLowerCase().trim();
  
  // First check custom rules (sorted by priority)
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
          category: rule.category,
          type: rule.transaction_type,
          confidence: 'rule',
          ruleName: rule.name
        };
      }
    }
  }
  
  // Then check historical transactions
  if (transactions && transactions.length > 0) {
    const categoryCount = {};
    
    transactions.forEach(t => {
      if (!t.description || !t.category) return;
      const tDescLower = t.description.toLowerCase();
      
      // Check for similar descriptions
      if (tDescLower.includes(descLower) || descLower.includes(tDescLower) ||
          (descLower.length > 4 && tDescLower.includes(descLower.substring(0, 4)))) {
        const key = `${t.category}|${t.type}`;
        categoryCount[key] = (categoryCount[key] || 0) + 1;
      }
    });
    
    // Find the most common category
    let maxCount = 0;
    let bestMatch = null;
    
    Object.entries(categoryCount).forEach(([key, count]) => {
      if (count > maxCount) {
        maxCount = count;
        const [category, type] = key.split('|');
        bestMatch = { category, type, confidence: 'history', matchCount: count };
      }
    });
    
    if (bestMatch && maxCount >= 1) {
      return bestMatch;
    }
  }
  
  return null;
}

export default function CategorySuggestion({ suggestion, onApply }) {
  if (!suggestion) return null;
  
  return (
    <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md">
      <Sparkles className="w-3 h-3" />
      <span>
        Suggested: <span className="font-medium capitalize">{(suggestion.category || '').replace(/_/g, ' ')}</span>
        {suggestion.confidence === 'rule' && (
          <span className="text-blue-500 ml-1">(rule: {suggestion.ruleName})</span>
        )}
        {suggestion.confidence === 'history' && (
          <span className="text-blue-500 ml-1">({suggestion.matchCount} similar)</span>
        )}
      </span>
      <Button 
        type="button"
        size="sm" 
        variant="ghost" 
        className="h-5 px-2 text-xs text-blue-700 hover:bg-blue-100"
        onClick={() => onApply(suggestion)}
      >
        Apply
      </Button>
    </div>
  );
}