import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { firstsavvy } from '@/api/firstsavvyClient';

export async function suggestContact(description, transactions, rules, contacts = []) {
  if (!description || description.length < 2) return null;
  if (!contacts || contacts.length === 0) return null;

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
        const contact = contacts.find(c => c.id === rule.contact_id);
        if (contact) {
          return {
            contactId: contact.id,
            contactName: contact.name,
            confidence: 'rule',
            ruleName: rule.name
          };
        }
      }
    }
  }

  if (transactions && transactions.length > 0) {
    const contactCount = {};

    transactions
      .filter(t => t.contact_id && t.contact_manually_set)
      .forEach(t => {
        if (!t.description || !t.contact_id) return;

        const tDescLower = t.description.toLowerCase();

        if (tDescLower.includes(descLower) || descLower.includes(tDescLower) ||
            (descLower.length > 4 && tDescLower.includes(descLower.substring(0, 4)))) {
          contactCount[t.contact_id] = (contactCount[t.contact_id] || 0) + 1;
        }
      });

    let maxCount = 0;
    let bestContactId = null;

    Object.entries(contactCount).forEach(([contactId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestContactId = contactId;
      }
    });

    if (bestContactId && maxCount >= 1) {
      const contact = contacts.find(c => c.id === bestContactId);
      if (contact) {
        return {
          contactId: contact.id,
          contactName: contact.name,
          confidence: 'history',
          matchCount: maxCount
        };
      }
    }
  }

  try {
    const aiResult = await firstsavvy.functions.aiSuggestContact({
      description,
      contacts: contacts.map(c => ({ id: c.id, name: c.name, type: c.type }))
    });

    if (aiResult && aiResult.contactId) {
      return {
        contactId: aiResult.contactId,
        contactName: aiResult.contactName,
        confidence: aiResult.confidence || 'ai'
      };
    }
  } catch (error) {
    console.error('AI contact suggestion failed:', error);
  }

  return null;
}

export default function ContactSuggestion({ suggestion, onApply }) {
  if (!suggestion) return null;

  const isAI = suggestion.confidence === 'ai' || suggestion.confidence === 'pattern';

  return (
    <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
      isAI ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
    }`}>
      {isAI ? <Zap className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      <span>
        Suggested: <span className="font-medium">{suggestion.contactName}</span>
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
