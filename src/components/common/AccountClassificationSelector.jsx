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
  const [selectedType, setSelectedType] = useState('');
  const [selectedClassification, setSelectedClassification] = useState(null);

  const { data: allClassifications = [] } = useQuery({
    queryKey: ['account-classifications', classFilter],
    queryFn: () => classFilter ? accountClassifications.getByClass(classFilter) : accountClassifications.getAll(),
    staleTime: 5 * 60 * 1000
  });

  const types = React.useMemo(() => {
    const typeSet = new Set(allClassifications.map(c => c.type));
    return Array.from(typeSet).sort();
  }, [allClassifications]);

  const categoriesForType = React.useMemo(() => {
    if (!selectedType) return [];
    return allClassifications
      .filter(c => c.type === selectedType)
      .sort((a, b) => {
        const aName = accountClassifications.getDisplayName(a);
        const bName = accountClassifications.getDisplayName(b);
        return aName.localeCompare(bName);
      });
  }, [selectedType, allClassifications]);

  useEffect(() => {
    if (value && allClassifications.length > 0) {
      const classification = allClassifications.find(c => c.id === value);
      if (classification) {
        setSelectedType(classification.type);
        setSelectedClassification(classification);
      }
    } else {
      setSelectedType('');
      setSelectedClassification(null);
    }
  }, [value, allClassifications]);

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setSelectedClassification(null);
    onValueChange?.(null);
  };

  const handleCategoryChange = (classificationId) => {
    const classification = allClassifications.find(c => c.id === classificationId);
    setSelectedClassification(classification);
    onValueChange?.(classificationId);
  };

  const getClassBadgeColor = (classType) => {
    const colors = {
      'asset': 'bg-green-100 text-green-800',
      'liability': 'bg-red-100 text-red-800',
      'income': 'bg-blue-100 text-blue-800',
      'expense': 'bg-orange-100 text-orange-800',
      'equity': 'bg-purple-100 text-purple-800'
    };
    return colors[classType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-3">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Type</Label>
          <ClickThroughSelect
            value={selectedType}
            onValueChange={handleTypeChange}
            placeholder="Select type"
            triggerClassName="h-9 border-slate-300"
            disabled={disabled}
          >
            {types.map(type => {
              const classType = allClassifications.find(c => c.type === type)?.class;
              return (
                <ClickThroughSelectItem key={type} value={type}>
                  <div className="flex items-center justify-between w-full">
                    <span>{type}</span>
                    {classType && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getClassBadgeColor(classType)}`}>
                        {classType}
                      </span>
                    )}
                  </div>
                </ClickThroughSelectItem>
              );
            })}
          </ClickThroughSelect>
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Category</Label>
          <ClickThroughSelect
            value={selectedClassification?.id || ''}
            onValueChange={handleCategoryChange}
            placeholder={selectedType ? "Select category" : "Select type first"}
            triggerClassName="h-9 border-slate-300"
            disabled={disabled || !selectedType}
            enableSearch={true}
          >
            {categoriesForType.map(classification => {
              const displayName = accountClassifications.getDisplayName(classification);
              const isCustom = classification.is_custom;

              return (
                <ClickThroughSelectItem key={classification.id} value={classification.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{displayName}</span>
                    {isCustom && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        custom
                      </span>
                    )}
                  </div>
                </ClickThroughSelectItem>
              );
            })}
            {categoriesForType.length === 0 && selectedType && (
              <div className="px-2 py-1.5 text-sm text-slate-500 italic">
                No categories available for this type
              </div>
            )}
          </ClickThroughSelect>
        </div>
      </div>

      {selectedClassification && (
        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getClassBadgeColor(selectedClassification.class)}`}>
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
