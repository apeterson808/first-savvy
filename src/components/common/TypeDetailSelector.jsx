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
  disabled = false,
  inline = false,
  showTypeOnly = false,
  showDetailOnly = false
}) {
  const availableTypes = getAccountTypes(classFilter);
  const availableDetails = accountType ? getAccountDetails(classFilter, accountType) : [];

  useEffect(() => {
    if (accountType && !availableDetails.includes(accountDetail)) {
      onDetailChange?.(null);
    }
  }, [accountType, classFilter]);

  if (showDetailOnly) {
    return (
      <div>
        {!inline && detailLabel && (
          <Label htmlFor="account-detail">
            {detailLabel}
            {required && <span className="text-red-500">*</span>}
          </Label>
        )}
        <Select
          value={accountDetail || ''}
          onValueChange={(value) => onDetailChange?.(value)}
          disabled={disabled || !accountType}
        >
          <SelectTrigger id="account-detail" className={inline ? '' : 'mt-1.5'}>
            <SelectValue placeholder={accountType ? "Select detail" : "Select type first"} />
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
    );
  }

  if (showTypeOnly) {
    return (
      <div>
        {!inline && typeLabel && (
          <Label htmlFor="account-type">
            {typeLabel}
            {required && <span className="text-red-500">*</span>}
          </Label>
        )}
        <Select
          value={accountType || ''}
          onValueChange={(value) => onTypeChange?.(value)}
          disabled={disabled}
        >
          <SelectTrigger id="account-type" className={inline ? '' : 'mt-1.5'}>
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
    );
  }

  return (
    <div className={inline ? 'flex gap-3' : 'space-y-4'}>
      <div className={inline ? 'flex-1' : ''}>
        {!inline && typeLabel && (
          <Label htmlFor="account-type">
            {typeLabel}
            {required && <span className="text-red-500">*</span>}
          </Label>
        )}
        <Select
          value={accountType || ''}
          onValueChange={(value) => onTypeChange?.(value)}
          disabled={disabled}
        >
          <SelectTrigger id="account-type" className={inline ? '' : 'mt-1.5'}>
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
        <div className={inline ? 'flex-1' : ''}>
          {!inline && detailLabel && (
            <Label htmlFor="account-detail">
              {detailLabel}
              {required && <span className="text-red-500">*</span>}
            </Label>
          )}
          <Select
            value={accountDetail || ''}
            onValueChange={(value) => onDetailChange?.(value)}
            disabled={disabled}
          >
            <SelectTrigger id="account-detail" className={inline ? '' : 'mt-1.5'}>
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
