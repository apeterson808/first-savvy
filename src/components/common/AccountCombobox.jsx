import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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

  const handleInputChange = (newValue) => {
    setSearchValue(newValue);
    const matchingAccount = accounts.find(acc =>
      acc.display_name.toLowerCase() === newValue.toLowerCase()
    );

    if (matchingAccount) {
      onValueChange(matchingAccount.id, matchingAccount.display_name, true);
    } else {
      onValueChange(newValue, newValue, false);
    }
  };

  const displayValue = () => {
    if (!value) return placeholder;

    const account = accounts.find(acc => acc.id === value);
    if (account) {
      return account.display_name;
    }

    return value;
  };

  const filteredAccounts = accounts.filter(acc =>
    acc.display_name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const isExistingAccount = accounts.some(acc => acc.id === value);
  const showNewIndicator = value && !isExistingAccount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {displayValue()}
            {showNewIndicator && (
              <span className="ml-2 text-xs text-blue-600 font-medium">(New)</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Type to search or create new..."
            value={searchValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {filteredAccounts.length === 0 && searchValue ? (
              <CommandEmpty>
                <div className="py-2 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    No existing accounts found
                  </p>
                  <p className="text-xs text-blue-600">
                    Press Enter to create "{searchValue}"
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <>
                {searchValue && !isExistingAccount && (
                  <CommandGroup heading="Create New">
                    <CommandItem
                      value={searchValue}
                      onSelect={() => {
                        onValueChange(searchValue, searchValue, false);
                        setOpen(false);
                      }}
                      className="text-blue-600"
                    >
                      <span>Create "{searchValue}"</span>
                    </CommandItem>
                  </CommandGroup>
                )}
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
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
