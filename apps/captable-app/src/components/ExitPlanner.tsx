import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Calculator, TrendingUp, DollarSign } from 'lucide-react';
import type { EventBase, ExitWaterfall } from '../types';
import { PERSON_TYPE_LABELS } from '../types';
import { replayAllEvents, calculateExitWaterfall } from '../lib/capTableEngine';

interface ExitPlannerProps {
  companyId: string;
  events: EventBase[];
  currency: string;
}

const CHART_COLORS = [
  '#1e3a5f',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CNY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

export function ExitPlanner({ companyId, events, currency }: ExitPlannerProps) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const [exitValuation, setExitValuation] = useState<string>('10000000');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [waterfall, setWaterfall] = useState<ExitWaterfall | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: string | number) => {
    return `${currencySymbol}${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  // Compute cap table state for exit calculation
  const capTableState = useMemo(() => {
    if (events.length === 0) return null;
    
    // If a specific event is selected, replay up to that point
    const eventsToUse = selectedEventId
      ? events.filter(e => {
          const eventIndex = events.findIndex(ev => ev.id === selectedEventId);
          const currentIndex = events.findIndex(ev => ev.id === e.id);
          return currentIndex <= eventIndex;
        })
      : events;
    
    const { finalState } = replayAllEvents(companyId, eventsToUse);
    return finalState;
  }, [companyId, events, selectedEventId]);

  const handleCalculate = () => {
    if (!exitValuation || Number(exitValuation) <= 0) {
      setError('Please enter a valid exit valuation');
      return;
    }

    if (!capTableState) {
      setError('No cap table data available');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const result = calculateExitWaterfall(capTableState, Number(exitValuation));
      setWaterfall(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate exit scenario');
    } finally {
      setIsCalculating(false);
    }
  };

  // Prepare chart data
  const chartData = waterfall?.distributions.map((d, i) => ({
    name: d.holderName.length > 15 ? d.holderName.substring(0, 15) + '...' : d.holderName,
    proceeds: Number(d.proceeds),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Exit Scenario Parameters
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="input-label">Exit Valuation</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={exitValuation}
                  onChange={(e) => setExitValuation(e.target.value)}
                  className="input pl-7"
                  placeholder="10,000,000"
                />
              </div>
              <p className="input-help">Total company sale price</p>
            </div>

            <div>
              <label className="input-label">As Of Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="select"
              >
                <option value="">Current (Latest)</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.label} ({new Date(event.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <p className="input-help">Calculate based on cap table at this point</p>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCalculate}
                disabled={isCalculating}
                className="btn-primary w-full"
              >
                {isCalculating ? 'Calculating...' : 'Calculate Waterfall'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-charcoal-50 rounded-sm border border-charcoal-100">
        <p className="text-sm text-charcoal-600">
          <strong className="text-charcoal-900">Exit Waterfall Analysis</strong> calculates how 
          proceeds from a company sale would be distributed among shareholders. The calculation 
          considers liquidation preferences, participation rights, and conversion options for 
          each share class. Preferred shareholders may choose to take their liquidation preference 
          or convert to common stock, whichever yields higher returns.
        </p>
      </div>

      {/* Results */}
      {waterfall && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-label">Exit Valuation</div>
              <div className="stat-value">{formatCurrency(waterfall.exitValuation)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Distributed</div>
              <div className="stat-value">{formatCurrency(waterfall.totalDistributed)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Stakeholders</div>
              <div className="stat-value">{waterfall.distributions.length}</div>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-charcoal-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Proceeds Distribution
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e7e7" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="#6d6d6d"
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="#6d6d6d"
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e7e7e7',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Proceeds']}
                  />
                  <Bar dataKey="proceeds" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Waterfall Details
              </h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Stakeholder</th>
                  <th>Type</th>
                  <th className="text-right">Investment</th>
                  <th className="text-right">Proceeds</th>
                  <th className="text-right">% of Exit</th>
                  <th className="text-right">Multiple</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {waterfall.distributions.map((dist, index) => (
                  <tr key={dist.holderId}>
                    <td className="font-medium">{dist.holderName}</td>
                    <td>
                      <span className="badge-default">
                        {PERSON_TYPE_LABELS[dist.holderType]}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {dist.investmentAmount && Number(dist.investmentAmount) > 0
                        ? formatCurrency(dist.investmentAmount)
                        : '—'}
                    </td>
                    <td className="text-right font-mono font-medium text-emerald-600">
                      {formatCurrency(dist.proceeds)}
                    </td>
                    <td className="text-right font-mono">
                      {dist.percentOfExit}%
                    </td>
                    <td className="text-right font-mono">
                      <span className={
                        dist.multiple !== 'N/A' && parseFloat(dist.multiple) >= 1
                          ? 'text-emerald-600'
                          : dist.multiple !== 'N/A'
                          ? 'text-red-600'
                          : ''
                      }>
                        {dist.multiple}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        dist.method.includes('preference') 
                          ? 'badge-warning' 
                          : dist.method.includes('participating')
                          ? 'badge-primary'
                          : 'badge-success'
                      }`}>
                        {dist.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-charcoal-50">
                  <td colSpan={3} className="font-medium">Total</td>
                  <td className="text-right font-mono font-medium">
                    {formatCurrency(waterfall.totalDistributed)}
                  </td>
                  <td className="text-right font-mono font-medium">100.00%</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Method Explanation */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-charcoal-900">
                Understanding the Methods
              </h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="badge-warning mb-2">preference</span>
                  <p className="text-charcoal-600">
                    Investor takes their liquidation preference (typically 1x their investment) 
                    before common shareholders receive anything.
                  </p>
                </div>
                <div>
                  <span className="badge-success mb-2">conversion</span>
                  <p className="text-charcoal-600">
                    Preferred shares convert to common stock and participate pro-rata, 
                    giving up the liquidation preference for potentially higher returns.
                  </p>
                </div>
                <div>
                  <span className="badge-primary mb-2">participating</span>
                  <p className="text-charcoal-600">
                    Investor gets their preference first, then also participates in the 
                    remaining proceeds pro-rata with common shareholders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!waterfall && !isCalculating && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-charcoal-100 flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-charcoal-400" />
          </div>
          <h3 className="text-lg font-medium text-charcoal-900 mb-2">
            Model an Exit Scenario
          </h3>
          <p className="text-charcoal-600 max-w-md mx-auto">
            Enter an exit valuation above to see how proceeds would be distributed 
            among shareholders based on liquidation preferences and conversion rights.
          </p>
        </div>
      )}
    </div>
  );
}

