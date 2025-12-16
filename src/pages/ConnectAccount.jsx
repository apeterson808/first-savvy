import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, TrendingUp, Bitcoin, Upload, FlaskConical, X, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PlaidLinkButton from '../components/banking/PlaidLinkButton';
import PlaidImportSimulator from '../components/banking/PlaidImportSimulator';
import FileImporter from '../components/banking/FileImporter';
import AmazonOrderImporter from '../components/banking/AmazonOrderImporter';
import { useQueryClient } from '@tanstack/react-query';

const POPULAR_INSTITUTIONS = [
  { name: 'Chase', color: 'bg-blue-600' },
  { name: 'Bank of America', color: 'bg-red-600' },
  { name: 'Wells Fargo', color: 'bg-red-500' },
  { name: 'Capital One', color: 'bg-blue-700' },
  { name: 'Citi', color: 'bg-blue-500' },
  { name: 'American Express', color: 'bg-blue-600' },
  { name: 'US Bank', color: 'bg-red-600' },
  { name: 'Charles Schwab', color: 'bg-blue-500' },
  { name: 'Fidelity', color: 'bg-green-600' },
  { name: 'Vanguard', color: 'bg-red-700' },
  { name: 'Discover', color: 'bg-orange-600' },
  { name: 'Navy Federal', color: 'bg-blue-900' },
];

export default function ConnectAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [plaidSimulatorOpen, setPlaidSimulatorOpen] = useState(false);
  const [fileImporterOpen, setFileImporterOpen] = useState(false);
  const [amazonImporterOpen, setAmazonImporterOpen] = useState(false);

  const linkCategories = [
    {
      title: 'Connect bank accounts and credit cards',
      icon: Building2,
      color: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Connect investments and loans',
      icon: TrendingUp,
      color: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      title: 'Add your Crypto',
      icon: Bitcoin,
      color: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    {
      title: 'Import from CSV, PDF, or OFX',
      icon: Upload,
      color: 'bg-teal-100',
      iconColor: 'text-teal-600'
    },
    {
      title: 'Import Amazon Orders',
      icon: Package,
      color: 'bg-orange-100',
      iconColor: 'text-orange-600',
      isAmazon: true
    }
  ];

  const handleSuccess = (result) => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    navigate(-1);
  };

  const filteredInstitutions = POPULAR_INSTITUTIONS.filter(inst =>
    inst.name.toLowerCase().includes(linkSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Connect an account</h1>
            <p className="text-sm text-slate-600 mt-1">Connect your bank or credit card to bring in your transactions</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search 13,000+ institutions"
            value={linkSearchTerm}
            onChange={(e) => setLinkSearchTerm(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Popular Institutions */}
        {!linkSearchTerm ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">POPULAR INSTITUTIONS</h3>
            <div className="grid grid-cols-6 gap-3">
              {POPULAR_INSTITUTIONS.map((inst) => (
                <PlaidLinkButton
                  key={inst.name}
                  onSuccess={handleSuccess}
                  className="p-0 h-auto bg-transparent hover:bg-transparent border-0"
                >
                  <div className="flex flex-col items-center gap-2 group cursor-pointer">
                    <div className={`w-16 h-16 rounded-full ${inst.color} flex items-center justify-center text-white text-xl font-bold group-hover:scale-105 transition-transform`}>
                      {inst.name.charAt(0)}
                    </div>
                    <span className="text-xs text-slate-600 text-center">{inst.name}</span>
                  </div>
                </PlaidLinkButton>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              {filteredInstitutions.length} RESULTS
            </h3>
            {filteredInstitutions.length > 0 ? (
              <div className="space-y-2">
                {filteredInstitutions.map((inst) => (
                  <PlaidLinkButton
                    key={inst.name}
                    onSuccess={handleSuccess}
                    className="w-full p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all h-auto justify-start font-normal"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${inst.color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {inst.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{inst.name}</span>
                    </div>
                  </PlaidLinkButton>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No institutions found</p>
            )}
          </div>
        )}

        {/* Categories */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">CATEGORIES</h3>
          <div className="grid grid-cols-2 gap-3">
            {linkCategories.map((category, index) => {
              const Icon = category.icon;
              const isImportCategory = category.title.includes('Import');
              const isAmazonImport = category.isAmazon;

              if (isAmazonImport) {
                return (
                  <button
                    key={index}
                    onClick={() => setAmazonImporterOpen(true)}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${category.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-6 h-6 ${category.iconColor}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-900">{category.title}</span>
                    </div>
                  </button>
                );
              }

              return isImportCategory ? (
                <button
                  key={index}
                  onClick={() => setFileImporterOpen(true)}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${category.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${category.iconColor}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{category.title}</span>
                  </div>
                </button>
              ) : (
                <PlaidLinkButton
                  key={index}
                  onSuccess={handleSuccess}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all h-auto justify-start font-normal"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${category.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${category.iconColor}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{category.title}</span>
                  </div>
                </PlaidLinkButton>
              );
            })}
          </div>
        </div>

        {/* Development Tools */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mt-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">DEVELOPMENT</h3>
          <button
            onClick={() => setPlaidSimulatorOpen(true)}
            className="w-full p-4 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 hover:shadow-sm transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-900 block">Simulate Plaid Import</span>
                <span className="text-xs text-slate-500">Test the account linking flow with sample data</span>
              </div>
            </div>
          </button>
        </div>

        <PlaidImportSimulator 
          open={plaidSimulatorOpen} 
          onOpenChange={setPlaidSimulatorOpen}
          onImportComplete={(accounts) => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            navigate(-1);
          }}
        />

        <FileImporter
          open={fileImporterOpen}
          onOpenChange={setFileImporterOpen}
          onImportComplete={(accounts) => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            navigate(-1);
          }}
        />

        <AmazonOrderImporter
          open={amazonImporterOpen}
          onOpenChange={setAmazonImporterOpen}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            navigate(-1);
          }}
        />
      </div>
    </div>
  );
}