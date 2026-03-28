import { Cable } from 'lucide-react';

export default function Integrations() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Cable className="w-24 h-24 text-slate-400" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 mb-2">
          Integrations
        </h1>
        <p className="text-lg text-slate-600">
          Coming soon
        </p>
      </div>
    </div>
  );
}
