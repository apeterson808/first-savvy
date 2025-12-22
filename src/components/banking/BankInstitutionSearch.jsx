import { useState, useEffect, useMemo } from 'react';
import { Search, Building2, TrendingUp } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function BankInstitutionSearch({ onSelect, onManualAdd }) {
  const [institutions, setInstitutions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_institutions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setInstitutions(data || []);
    } catch (error) {
      console.error('Error loading institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInstitutions = useMemo(() => {
    if (!searchQuery.trim()) {
      return institutions.filter(inst => inst.sort_order <= 10);
    }

    const query = searchQuery.toLowerCase();
    return institutions.filter(inst =>
      inst.name.toLowerCase().includes(query) ||
      inst.full_name.toLowerCase().includes(query)
    );
  }, [institutions, searchQuery]);

  const popularBanks = useMemo(() => {
    return institutions.filter(inst => inst.sort_order <= 5);
  }, [institutions]);

  const handleInstitutionSelect = (institution) => {
    onSelect(institution);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="space-y-2">
          <Label>Search for your bank</Label>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Search for your bank to securely connect your account
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bankSearch">Search for your bank</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="bankSearch"
              placeholder="Search for Chase, Wells Fargo, Bank of America..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {!searchQuery && popularBanks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Popular Banks
            </div>
            <div className="grid grid-cols-5 gap-3">
              {popularBanks.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => handleInstitutionSelect(institution)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent hover:border-accent-foreground/20 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                    {institution.logo_url ? (
                      <img
                        src={institution.logo_url}
                        alt={institution.name}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <Building2
                      className="h-6 w-6 text-muted-foreground"
                      style={{ display: institution.logo_url ? 'none' : 'flex' }}
                    />
                  </div>
                  <span className="text-xs text-center line-clamp-2 group-hover:text-foreground">
                    {institution.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-4 w-4" />
            {searchQuery ? `Results (${filteredInstitutions.length})` : 'All Banks'}
          </div>
          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-2 space-y-1">
              {filteredInstitutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No banks found matching "{searchQuery}"</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                filteredInstitutions.map((institution) => (
                  <button
                    key={institution.id}
                    onClick={() => handleInstitutionSelect(institution)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center border flex-shrink-0">
                      {institution.logo_url ? (
                        <img
                          src={institution.logo_url}
                          alt={institution.name}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <Building2
                        className="h-5 w-5 text-muted-foreground"
                        style={{ display: institution.logo_url ? 'none' : 'flex' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{institution.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {institution.full_name}
                      </div>
                    </div>
                    {institution.institution_type !== 'bank' && (
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {institution.institution_type === 'credit_union' ? 'Credit Union' : 'Brokerage'}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="text-center">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-xs"
            onClick={onManualAdd}
          >
            Add Manually
          </Button>
        </div>
      </div>
    </div>
  );
}
