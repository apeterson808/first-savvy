import { useState, useEffect } from 'react';
import { Search, Building2, CreditCard, Landmark, Lock } from 'lucide-react';
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
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00d4b4] mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading institutions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#f0fdf9] border border-[#00d4b4]/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-[#00a58e] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">Securely connect your account</p>
            <p className="text-xs text-gray-600 mt-1">
              Powered by Plaid. Your credentials are encrypted and never stored.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Select your institution</h3>
        <p className="text-sm text-gray-600">
          Search for your bank or credit union
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search institutions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 h-12 text-base border-2 focus:border-[#00d4b4] focus-visible:ring-[#00d4b4]"
        />
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filteredInstitutions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No institutions found</p>
          </div>
        ) : (
          filteredInstitutions.map((institution) => (
            <button
              key={institution.id}
              className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-[#00d4b4] hover:bg-[#f0fdf9]/50 transition-all text-left group"
              onClick={() => onSelectBank(institution)}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-xl flex-shrink-0"
                  style={{ backgroundColor: institution.primary_color + '15' }}
                >
                  <div style={{ color: institution.primary_color }}>
                    {getInstitutionIcon(institution.institution_type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-base mb-0.5">{institution.name}</h4>
                  <p className="text-sm text-gray-500 truncate">
                    {institution.full_name}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
