import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function AccountCombobox({ accounts, value, onValueChange, placeholder = "Select or type account name..." }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (value && !accounts.find(acc => acc.id === value)) {
      setSearchValue(value);
    } else if (value) {
      const account = accounts.find(acc => acc.id === value);
      setSearchValue(account?.display_name || '');
    }
  }, [value, accounts]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (currentValue) => {
    const account = accounts.find(acc => acc.id === currentValue);
    if (account) {
      onValueChange(currentValue, account.display_name, true);
      setSearchValue(account.display_name);
    }
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    setOpen(newValue.length > 0);

    const matchingAccount = accounts.find(acc =>
      acc.display_name.toLowerCase() === newValue.toLowerCase()
    );

    if (matchingAccount) {
      onValueChange(matchingAccount.id, matchingAccount.display_name, true);
    } else {
      onValueChange(newValue, newValue, false);
    }
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.display_name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showDropdown = open && searchValue && (filteredAccounts.length > 0 || searchValue);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleInputChange}
        onFocus={() => searchValue && setOpen(true)}
        className="w-full"
      />

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-[300px] overflow-auto">
          {filteredAccounts.length === 0 ? (
            <div className="py-3 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Will create new account "{searchValue}"
              </p>
            </div>
          ) : (
            <div className="py-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Existing Accounts
              </div>
              {filteredAccounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => handleSelect(account.id)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{account.display_name}</div>
                    {account.institution_name && (
                      <div className="text-xs text-muted-foreground">
                        {account.institution_name}
                        {account.account_number_last4 && ` • ****${account.account_number_last4}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
