import { useState, useEffect } from 'react';
import { Search, Building2, CreditCard, Landmark } from 'lucide-react';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getAvailableInstitutions } from '../../api/bankSimulation';

export function BankSelectionStep({ onSelectBank }) {
  const [institutions, setInstitutions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInstitutions();
  }, []);

  async function loadInstitutions() {
    try {
      const data = await getAvailableInstitutions();
      setInstitutions(data);
    } catch (error) {
      console.error('Error loading institutions:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInstitutionIcon = (type) => {
    switch (type) {
      case 'credit_union':
        return <Landmark className="h-8 w-8" />;
      case 'brokerage':
        return <CreditCard className="h-8 w-8" />;
      default:
        return <Building2 className="h-8 w-8" />;
    }
  };

  const getInstitutionTypeLabel = (type) => {
    switch (type) {
      case 'credit_union':
        return 'Credit Union';
      case 'brokerage':
        return 'Brokerage';
      default:
        return 'Bank';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading banks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Your Bank</h3>
        <p className="text-sm text-muted-foreground">
          Choose your financial institution to connect your account
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for your bank..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {filteredInstitutions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No banks found</p>
          </div>
        ) : (
          filteredInstitutions.map((institution) => (
            <Card
              key={institution.id}
              className="cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => onSelectBank(institution)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-lg"
                      style={{ backgroundColor: institution.primary_color + '20' }}
                    >
                      <div style={{ color: institution.primary_color }}>
                        {getInstitutionIcon(institution.institution_type)}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold">{institution.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {institution.full_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {getInstitutionTypeLabel(institution.institution_type)}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
