import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search } from 'lucide-react';

export function PlaidLoanSearch({ onManualEntry, onBack, onPlaidSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handlePlaidIntegration = () => {
    console.log('Plaid integration coming soon');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Connect Your Lender</h3>
        <p className="text-sm text-muted-foreground">
          Search for your auto loan lender to securely connect your account
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lenderSearch">Search for your lender</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="lenderSearch"
              placeholder="Search for Chase, Wells Fargo, etc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Plaid integration coming soon. For now, please add your loan manually.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onManualEntry}
        >
          Add loan manually
        </Button>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
