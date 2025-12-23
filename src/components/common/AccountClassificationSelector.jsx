import React, { useState, useEffect } from 'react';
import { accountClassifications } from '@/api/accountClassifications';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem } from '@/components/ui/ClickThroughSelect';

export default function AccountClassificationSelector({
  value,
  onValueChange,
  classFilter = null,
  disabled = false,
  label = "Account Type",
  required = false,
  error = null
}) {
  const [selectedClassification, setSelectedClassification] = useState(null);

  const { data: allClassifications = [] } = useQuery({
    queryKey: ['account-classifications', classFilter],
    queryFn: () => classFilter ? accountClassifications.getByClass(classFilter) : accountClassifications.getAll(),
    staleTime: 5 * 60 * 1000
  });

  const groupedClassifications = React.useMemo(() => {
    const groups = {};
    allClassifications.forEach(c => {
      const key = `${c.class}|${c.type}`;
      if (!groups[key]) {
        groups[key] = {
          class: c.class,
          type: c.type,
          items: []
        };
      }
      groups[key].items.push(c);
    });

    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        const aName = accountClassifications.getDisplayName(a);
        const bName = accountClassifications.getDisplayName(b);
        return aName.localeCompare(bName);
      });
    });

    return Object.values(groups).sort((a, b) => {
      const classOrder = { asset: 1, liability: 2, income: 3, expense: 4, equity: 5 };
      const classCompare = (classOrder[a.class] || 99) - (classOrder[b.class] || 99);
      if (classCompare !== 0) return classCompare;
      return a.type.localeCompare(b.type);
    });
  }, [allClassifications]);

  useEffect(() => {
    if (value && allClassifications.length > 0) {
      const classification = allClassifications.find(c => c.id === value);
      setSelectedClassification(classification);
    } else {
      setSelectedClassification(null);
    }
  }, [value, allClassifications]);

  const handleChange = (classificationId) => {
    const classification = allClassifications.find(c => c.id === classificationId);
    setSelectedClassification(classification);
    onValueChange?.(classificationId);
  };

  const getClassBadgeColor = (classType) => {
    const colors = {
      'asset': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'liability': 'bg-rose-100 text-rose-700 border-rose-200',
      'income': 'bg-sky-100 text-sky-700 border-sky-200',
      'expense': 'bg-orange-100 text-orange-700 border-orange-200',
      'equity': 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return colors[classType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-3">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <ClickThroughSelect
        value={selectedClassification?.id || ''}
        onValueChange={handleChange}
        placeholder="Select account type"
        disabled={disabled}
        enableSearch={true}
      >
        {groupedClassifications.map((group) => (
          <React.Fragment key={`${group.class}-${group.type}`}>
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getClassBadgeColor(group.class)}`}>
                  {group.class}
                </span>
                <span>›</span>
                <span>{group.type}</span>
              </div>
            </div>
            {group.items.map(classification => {
              const displayName = accountClassifications.getDisplayName(classification);
              const isCustom = classification.is_custom;

              return (
                <ClickThroughSelectItem key={classification.id} value={classification.id}>
                  <div className="flex items-center justify-between w-full pl-2">
                    <span>{displayName}</span>
                    {isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-100 text-violet-700 border-violet-200 font-medium">
                        custom
                      </span>
                    )}
                  </div>
                </ClickThroughSelectItem>
              );
            })}
          </React.Fragment>
        ))}
        {allClassifications.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-slate-500 italic">
            No account types available
          </div>
        )}
      </ClickThroughSelect>

      {selectedClassification && (
        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${getClassBadgeColor(selectedClassification.class)}`}>
              {selectedClassification.class}
            </span>
            <span className="text-slate-400">›</span>
            <span className="font-medium">{selectedClassification.type}</span>
            <span className="text-slate-400">›</span>
            <span>{accountClassifications.getDisplayName(selectedClassification)}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
