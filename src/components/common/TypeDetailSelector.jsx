import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAccountTypes, getAccountDetails } from '@/utils/accountTypeMapping';

export default function TypeDetailSelector({
  classFilter,
  accountType,
  accountDetail,
  onTypeChange,
  onDetailChange,
  typeLabel = 'Account Type',
  detailLabel = 'Account Detail',
  required = false,
  disabled = false
}) {
  const availableTypes = getAccountTypes(classFilter);
  const availableDetails = accountType ? getAccountDetails(classFilter, accountType) : [];

  useEffect(() => {
    if (accountType && !availableDetails.includes(accountDetail)) {
      onDetailChange?.(null);
    }
  }, [accountType, classFilter]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="account-type">
          {typeLabel}
          {required && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={accountType || ''}
          onValueChange={(value) => onTypeChange?.(value)}
          disabled={disabled}
        >
          <SelectTrigger id="account-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {accountType && availableDetails.length > 0 && (
        <div>
          <Label htmlFor="account-detail">
            {detailLabel}
            {required && <span className="text-red-500">*</span>}
          </Label>
          <Select
            value={accountDetail || ''}
            onValueChange={(value) => onDetailChange?.(value)}
            disabled={disabled}
          >
            <SelectTrigger id="account-detail">
              <SelectValue placeholder="Select detail" />
            </SelectTrigger>
            <SelectContent>
              {availableDetails.map((detail) => (
                <SelectItem key={detail} value={detail}>
                  {detail}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
