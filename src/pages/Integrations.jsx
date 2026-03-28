import React from 'react';
import Layout from './Layout';
import { Cable, Plug2, Zap, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Integrations() {
  const integrationCategories = [
    {
      title: 'Banking & Financial',
      icon: Cable,
      items: ['Plaid', 'Stripe', 'PayPal', 'Square']
    },
    {
      title: 'Accounting Software',
      icon: Plug2,
      items: ['QuickBooks', 'Xero', 'FreshBooks', 'Wave']
    },
    {
      title: 'Payment Processors',
      icon: Zap,
      items: ['Venmo', 'Zelle', 'Cash App', 'Apple Pay']
    },
    {
      title: 'Investment Platforms',
      icon: Link2,
      items: ['Robinhood', 'E*TRADE', 'Fidelity', 'Charles Schwab']
    }
  ];

  return (
    <Layout currentPageName="Integrations">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Integrations</h1>
          <p className="text-slate-600">Connect your favorite financial tools and services</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrationCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription className="text-slate-500 mt-1">
                        Coming Soon
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-md border border-slate-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-full shadow-sm">
                  <Cable className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">More Integrations Coming Soon</h2>
                <p className="text-slate-600 max-w-md">
                  We're working hard to bring you seamless integrations with your favorite financial platforms.
                  Stay tuned for updates!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
