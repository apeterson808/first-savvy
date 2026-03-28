import React from 'react';
import Layout from './Layout';
import { Cable } from 'lucide-react';

export default function Integrations() {
  return (
    <Layout currentPageName="Integrations">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-6 bg-blue-50 rounded-full">
              <Cable className="w-16 h-16 text-blue-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Integrations</h1>
          <p className="text-2xl text-slate-600">Coming Soon</p>
        </div>
      </div>
    </Layout>
  );
}
