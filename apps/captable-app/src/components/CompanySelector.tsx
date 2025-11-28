import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ChevronRight, X } from 'lucide-react';
import type { Company } from '../types';

interface CompanySelectorProps {
  companies: Company[];
  onSelect: (company: Company) => void;
  onCreate: (data: Partial<Company>) => Promise<void>;
  onClose?: () => void;
}

export function CompanySelector({ companies, onSelect, onCreate, onClose }: CompanySelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(companies.length === 0);
  const [formData, setFormData] = useState({
    name: '',
    baseCurrency: 'USD',
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await onCreate({
        name: formData.name,
        baseCurrency: formData.baseCurrency,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Simple modal overlay
  return (
    <div className="fixed inset-0 bg-charcoal-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-sm shadow-lg"
      >
        <div className="px-5 py-4 border-b border-charcoal-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal-900">
            {showCreateForm ? 'New Company' : 'Select Company'}
          </h2>
          {onClose && (
            <button onClick={onClose} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!showCreateForm ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {companies.length > 0 ? (
                <div className="divide-y divide-charcoal-100">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => onSelect(company)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-charcoal-50 transition-colors text-left"
                    >
                      <div>
                        <h3 className="text-sm font-medium text-charcoal-900">
                          {company.name}
                        </h3>
                        <p className="text-xs text-charcoal-500 mt-0.5">
                          {company.baseCurrency}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-charcoal-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-charcoal-600 text-sm">
                  No companies yet
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-charcoal-100">
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Company
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div>
              <label className="input-label">Company Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Acme Corp"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Base Currency</label>
              <select
                value={formData.baseCurrency}
                onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                className="select"
              >
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              {companies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isCreating} className="btn-primary flex-1">
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
