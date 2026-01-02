import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function AccountCombobox({ accounts, value, onValueChange, placeholder = "Select or type account name..." }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && !accounts.find(acc => acc.id === value)) {
      setSearchValue(value);
    } else if (value) {
      const account = accounts.find(acc => acc.id === value);
      setSearchValue(account?.display_name || '');
    }
  }, [value, accounts]);

  const handleSelect = (currentValue) => {
    const account = accounts.find(acc => acc.id === currentValue);
    if (account) {
      onValueChange(currentValue, account.display_name, true);
      setSearchValue(account.display_name);
    }
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    setOpen(true);

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

  const isExistingAccount = accounts.some(acc => acc.id === value);

  return (
    <Popover open={open && (filteredAccounts.length > 0 || searchValue)} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            className="w-full"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            {filteredAccounts.length === 0 && searchValue ? (
              <CommandEmpty>
                <div className="py-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    Will create new account "{searchValue}"
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <>
                {filteredAccounts.length > 0 && (
                  <CommandGroup heading="Existing Accounts">
                    {filteredAccounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.id}
                        onSelect={handleSelect}
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
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
