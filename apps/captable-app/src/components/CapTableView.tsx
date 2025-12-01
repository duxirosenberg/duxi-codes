import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { CapTableResponse, EventBase, OwnershipSnapshot } from '../types';
import { PERSON_TYPE_LABELS, ESOP_POOL_HOLDER_ID } from '../types';

interface CapTableViewProps {
  capTable: CapTableResponse | null;
  events: EventBase[];
  ownershipHistory: OwnershipSnapshot[];
  companyId: string;
  currency: string;
}

type TabType = 'legal' | 'fully_diluted' | 'evolution';

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

const CHART_COLORS = [
  '#1e3a5f', // navy
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export function CapTableView({
  capTable,
  events,
  ownershipHistory,
  currency,
}: CapTableViewProps) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const [activeTab, setActiveTab] = useState<TabType>('legal');

  if (!capTable || capTable.legalCapTable.rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-charcoal-900 mb-2">
            No cap table data
          </h3>
          <p className="text-charcoal-600">
            Add an incorporation event to create your cap table.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-charcoal-100 rounded-sm w-fit">
        <button
          onClick={() => setActiveTab('legal')}
          className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
            activeTab === 'legal'
              ? 'bg-white text-charcoal-900 shadow-sm'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Legal Cap Table
        </button>
        <button
          onClick={() => setActiveTab('fully_diluted')}
          className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
            activeTab === 'fully_diluted'
              ? 'bg-white text-charcoal-900 shadow-sm'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Fully Diluted
          {capTable.fullyDilutedCapTable.unconvertedSAFEs.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              {capTable.fullyDilutedCapTable.unconvertedSAFEs.length} SAFEs
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('evolution')}
          className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
            activeTab === 'evolution'
              ? 'bg-white text-charcoal-900 shadow-sm'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Ownership Evolution
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {activeTab === 'legal' && (
          <LegalCapTable capTable={capTable} currencySymbol={currencySymbol} />
        )}
        {activeTab === 'fully_diluted' && (
          <FullyDilutedCapTable capTable={capTable} currencySymbol={currencySymbol} currency={currency} />
        )}
        {activeTab === 'evolution' && (
          <OwnershipEvolution 
            history={ownershipHistory} 
            events={events}
          />
        )}
      </motion.div>
    </div>
  );
}

function LegalCapTable({ capTable, currencySymbol }: { capTable: CapTableResponse; currencySymbol: string }) {
  const { legalCapTable } = capTable;
  const shareClasses = legalCapTable.shareClasses;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-label">Total Legal Shares</div>
          <div className="stat-value">{legalCapTable.totalShares.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shareholders</div>
          <div className="stat-value">{legalCapTable.rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Share Classes</div>
          <div className="stat-value">{shareClasses.length}</div>
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-charcoal-50 rounded-sm border border-charcoal-100">
        <p className="text-sm text-charcoal-600">
          <strong className="text-charcoal-900">Legal Cap Table</strong> shows only issued shares 
          (common and preferred stock). It excludes options, warrants, and convertible instruments 
          that haven't yet converted into equity.
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Shareholder</th>
              <th>Type</th>
              {shareClasses.map(sc => (
                <th key={sc.id} className="text-right">{sc.name}</th>
              ))}
              <th className="text-right">Total Shares</th>
              <th className="text-right">Ownership %</th>
            </tr>
          </thead>
          <tbody>
            {legalCapTable.rows.map((row) => (
              <tr key={row.holderId}>
                <td className="font-medium">{row.holderName}</td>
                <td>
                  <span className="badge-default">
                    {PERSON_TYPE_LABELS[row.holderType]}
                  </span>
                </td>
                {shareClasses.map(sc => (
                  <td key={sc.id} className="text-right font-mono">
                    {row.byClass[sc.name]?.toLocaleString() || '—'}
                  </td>
                ))}
                <td className="text-right font-mono font-medium">
                  {row.totalShares.toLocaleString()}
                </td>
                <td className="text-right font-mono">
                  {row.ownershipPercent}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-charcoal-50">
              <td colSpan={2} className="font-medium">Total</td>
              {shareClasses.map(sc => {
                const total = legalCapTable.rows.reduce((sum, r) => sum + (r.byClass[sc.name] || 0), 0);
                return (
                  <td key={sc.id} className="text-right font-mono font-medium">
                    {total.toLocaleString()}
                  </td>
                );
              })}
              <td className="text-right font-mono font-medium">
                {legalCapTable.totalShares.toLocaleString()}
              </td>
              <td className="text-right font-mono font-medium">100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function FullyDilutedCapTable({ capTable, currencySymbol, currency }: { capTable: CapTableResponse; currencySymbol: string; currency: string }) {
  const { fullyDilutedCapTable } = capTable;
  const [proFormaValuation, setProFormaValuation] = useState<string>('');

  // Get latest share price from preferred classes (last priced round)
  const preferredClasses = fullyDilutedCapTable.shareClasses.filter(sc => sc.type === 'preferred');
  const latestPreferred = preferredClasses[preferredClasses.length - 1];
  const latestPricePerShare = latestPreferred?.pricePerShare ? parseFloat(latestPreferred.pricePerShare) : null;
  
  // Calculate implied valuation
  const impliedValuation = latestPricePerShare 
    ? latestPricePerShare * fullyDilutedCapTable.totalShares 
    : null;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${currencySymbol}${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `${currencySymbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  // Group rows by investor name (combine multiple investments from same person)
  const groupedRows = useMemo(() => {
    const grouped = new Map<string, {
      holderName: string;
      holderType: string;
      isESOPPool: boolean;
      issuedShares: number;
      optionShares: number;
      totalShares: number;
    }>();

    for (const row of fullyDilutedCapTable.rows) {
      const existing = grouped.get(row.holderName);
      if (existing) {
        existing.issuedShares += row.issuedShares;
        existing.optionShares += row.optionShares;
        existing.totalShares += row.totalShares;
      } else {
        grouped.set(row.holderName, {
          holderName: row.holderName,
          holderType: row.holderType,
          isESOPPool: row.isESOPPool,
          issuedShares: row.issuedShares,
          optionShares: row.optionShares,
          totalShares: row.totalShares,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.totalShares - a.totalShares);
  }, [fullyDilutedCapTable.rows]);

  // Calculate pro forma ownership if SAFEs convert
  const proFormaData = useMemo(() => {
    const unconvertedSAFEs = fullyDilutedCapTable.unconvertedSAFEs;
    if (unconvertedSAFEs.length === 0) return null;

    const currentFDShares = fullyDilutedCapTable.totalShares;
    const inputValuation = proFormaValuation ? parseFloat(proFormaValuation) : null;
    
    // If no valuation input, use highest cap as default (or can't calculate for uncapped)
    const safesWithCaps = unconvertedSAFEs.filter(s => s.valuationCap);
    const highestCap = safesWithCaps.length > 0 
      ? Math.max(...safesWithCaps.map(s => Number(s.valuationCap)))
      : null;
    
    // Use input valuation, or fall back to highest cap
    const preMoneyValuation = inputValuation || highestCap;
    
    // If no valuation can be determined, we can still calculate using round price alone
    // This handles uncapped SAFEs
    const impliedPrice = preMoneyValuation 
      ? preMoneyValuation / currentFDShares 
      : (latestPricePerShare || 1); // Use latest price or $1 as fallback

    let totalSafeShares = 0;
    const safeConversions: Array<{
      investorName: string;
      principal: number;
      cap: number | null;
      discount: number;
      effectivePrice: number;
      shares: number;
      method: string;
    }> = [];

    for (const safe of unconvertedSAFEs) {
      const principal = Number(safe.principalAmount);
      let effectivePrice = impliedPrice;
      let method = 'round_price';

      // Cap price calculation
      if (safe.valuationCap && preMoneyValuation) {
        const capPrice = Number(safe.valuationCap) / currentFDShares;
        if (capPrice < effectivePrice) {
          effectivePrice = capPrice;
          method = 'cap';
        }
      }

      // Discount price
      if (safe.discountPercent && safe.discountPercent > 0) {
        const discountPrice = impliedPrice * (1 - safe.discountPercent / 100);
        if (discountPrice < effectivePrice) {
          effectivePrice = discountPrice;
          method = 'discount';
        }
      }

      const shares = Math.round(principal / effectivePrice);
      totalSafeShares += shares;

      safeConversions.push({
        investorName: safe.investorName || 'Unknown',
        principal,
        cap: safe.valuationCap ? Number(safe.valuationCap) : null,
        discount: safe.discountPercent || 0,
        effectivePrice,
        shares,
        method
      });
    }

    const totalSharesAfter = currentFDShares + totalSafeShares;
    const postMoneyValuation = preMoneyValuation 
      ? preMoneyValuation + unconvertedSAFEs.reduce((sum, s) => sum + Number(s.principalAmount), 0)
      : totalSharesAfter * impliedPrice;

    // Build pro forma rows (grouped)
    const proFormaRows = new Map<string, {
      holderName: string;
      holderType: string;
      currentShares: number;
      safeShares: number;
      totalShares: number;
      proFormaPercent: number;
    }>();

    // Add existing shareholders
    for (const row of groupedRows) {
      proFormaRows.set(row.holderName, {
        holderName: row.holderName,
        holderType: row.holderType,
        currentShares: row.totalShares,
        safeShares: 0,
        totalShares: row.totalShares,
        proFormaPercent: (row.totalShares / totalSharesAfter) * 100
      });
    }

    // Add/merge SAFE conversions
    for (const conv of safeConversions) {
      const existing = proFormaRows.get(conv.investorName);
      if (existing) {
        existing.safeShares += conv.shares;
        existing.totalShares += conv.shares;
        existing.proFormaPercent = (existing.totalShares / totalSharesAfter) * 100;
      } else {
        proFormaRows.set(conv.investorName, {
          holderName: conv.investorName,
          holderType: 'investor',
          currentShares: 0,
          safeShares: conv.shares,
          totalShares: conv.shares,
          proFormaPercent: (conv.shares / totalSharesAfter) * 100
        });
      }
    }

    return {
      preMoneyValuation,
      postMoneyValuation,
      impliedPrice,
      safeConversions,
      totalSafeShares,
      totalSharesAfter,
      currentFDShares,
      rows: Array.from(proFormaRows.values()).sort((a, b) => b.proFormaPercent - a.proFormaPercent),
      hasValuationInput: !!inputValuation
    };
  }, [fullyDilutedCapTable, groupedRows, proFormaValuation, latestPricePerShare]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="stat-label">Fully Diluted Shares</div>
          <div className="stat-value">{fullyDilutedCapTable.totalShares.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Latest Price/Share</div>
          <div className="stat-value">
            {latestPricePerShare ? `${currencySymbol}${latestPricePerShare.toFixed(4)}` : 'N/A'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Implied FD Valuation</div>
          <div className="stat-value">
            {impliedValuation ? formatCurrency(impliedValuation) : 'N/A'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding Options</div>
          <div className="stat-value">
            {fullyDilutedCapTable.rows
              .reduce((sum, r) => sum + r.optionShares, 0)
              .toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unconverted SAFEs</div>
          <div className="stat-value">{fullyDilutedCapTable.unconvertedSAFEs.length}</div>
        </div>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-charcoal-50 rounded-sm border border-charcoal-100">
        <p className="text-sm text-charcoal-600">
          <strong className="text-charcoal-900">Fully Diluted Cap Table</strong> includes all 
          issued shares plus all options (vested and unvested), unallocated ESOP pool. 
          Investors with multiple investments are grouped together.
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-charcoal-50 border-b border-charcoal-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider">Stakeholder</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[110px]">Issued</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[110px]">Options</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[110px]">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[80px]">FD %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Value</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row) => {
                const ownershipPercent = (row.totalShares / fullyDilutedCapTable.totalShares) * 100;
                const value = latestPricePerShare ? row.totalShares * latestPricePerShare : null;
                return (
                  <tr 
                    key={row.holderName}
                    className={`border-b border-charcoal-100 hover:bg-charcoal-50/50 ${row.isESOPPool ? 'bg-charcoal-50/50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.holderName}
                      {row.isESOPPool && (
                        <span className="ml-2 text-xs text-charcoal-500">(Unallocated)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge-default ${row.isESOPPool ? 'bg-blue-100 text-blue-700' : ''}`}>
                        {PERSON_TYPE_LABELS[row.holderType as keyof typeof PERSON_TYPE_LABELS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.issuedShares > 0 ? row.issuedShares.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.optionShares > 0 ? row.optionShares.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                      {row.totalShares.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {ownershipPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                      {value ? formatCurrency(value) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-charcoal-50">
                <td colSpan={2} className="px-4 py-3 font-medium">Total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                  {groupedRows.reduce((sum, r) => sum + r.issuedShares, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                  {groupedRows.reduce((sum, r) => sum + r.optionShares, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                  {fullyDilutedCapTable.totalShares.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">100.00%</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-emerald-600">
                  {impliedValuation ? formatCurrency(impliedValuation) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Outstanding SAFEs */}
      {fullyDilutedCapTable.unconvertedSAFEs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-charcoal-900">
              Outstanding SAFEs (Not Yet Converted)
            </h3>
          </div>
          <div className="p-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Type</th>
                  <th className="text-right">Principal</th>
                  <th className="text-right">Cap</th>
                  <th className="text-right">Discount</th>
                </tr>
              </thead>
              <tbody>
                {fullyDilutedCapTable.unconvertedSAFEs.map((safe) => (
                  <tr key={safe.id}>
                    <td className="font-medium">{safe.investorName || 'Unknown'}</td>
                    <td>
                      <span className="badge-warning">
                        {safe.valuationType === 'post_money' ? 'Post-Money' : 'Pre-Money'}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {currencySymbol}{Number(safe.principalAmount).toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      {safe.valuationCap 
                        ? `${currencySymbol}${Number(safe.valuationCap).toLocaleString()}`
                        : <span className="text-charcoal-400">Uncapped</span>}
                    </td>
                    <td className="text-right font-mono">
                      {safe.discountPercent ? `${safe.discountPercent}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pro Forma SAFE Conversion Simulation */}
      {fullyDilutedCapTable.unconvertedSAFEs.length > 0 && proFormaData && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-charcoal-900">
                Pro Forma Ownership (After SAFE Conversion)
              </h3>
              <p className="text-xs text-charcoal-500 mt-0.5">
                Simulate what ownership looks like if a priced round happens
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-charcoal-500">Pre-money valuation:</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">{currencySymbol}</span>
                <input
                  type="number"
                  value={proFormaValuation}
                  onChange={(e) => setProFormaValuation(e.target.value)}
                  placeholder="e.g. 10000000"
                  className="input w-40 pl-6 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
          
          {/* Simulation Summary */}
          <div className="px-4 py-3 bg-charcoal-50 border-b border-charcoal-100">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-charcoal-500">Pre-money:</span>{' '}
                <span className="font-mono font-medium">
                  {proFormaData.preMoneyValuation ? formatCurrency(proFormaData.preMoneyValuation) : 'Using round price'}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500">Post-money:</span>{' '}
                <span className="font-mono font-medium text-emerald-600">
                  {formatCurrency(proFormaData.postMoneyValuation)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500">Price/share:</span>{' '}
                <span className="font-mono font-medium">
                  {currencySymbol}{proFormaData.impliedPrice.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500">New shares from SAFEs:</span>{' '}
                <span className="font-mono font-medium">
                  +{proFormaData.totalSafeShares.toLocaleString()}
                </span>
              </div>
            </div>
            {!proFormaData.hasValuationInput && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ No valuation entered — using {proFormaData.preMoneyValuation ? 'highest SAFE cap' : 'latest round price'} as reference
              </p>
            )}
          </div>

          {/* Pro Forma Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-charcoal-50/50 border-b border-charcoal-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider">Stakeholder</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Current</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">+ SAFE</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Total</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[80px]">Own %</th>
                </tr>
              </thead>
              <tbody>
                {proFormaData.rows.map((row) => (
                  <tr key={row.holderName} className="border-b border-charcoal-100 hover:bg-charcoal-50/50">
                    <td className="px-4 py-2 font-medium">{row.holderName}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {row.currentShares > 0 ? row.currentShares.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                      {row.safeShares > 0 ? `+${row.safeShares.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-medium">
                      {row.totalShares.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {row.proFormaPercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-charcoal-50 font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {proFormaData.currentFDShares.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                    +{proFormaData.totalSafeShares.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {proFormaData.totalSharesAfter.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">100.00%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnershipEvolution({ 
  history, 
  events 
}: { 
  history: OwnershipSnapshot[]; 
  events: EventBase[];
}) {
  if (history.length === 0) {
    return (
      <div className="card p-12 text-center">
        <h3 className="text-lg font-medium text-charcoal-900 mb-2">
          No ownership history
        </h3>
        <p className="text-charcoal-600">
          Add events to see how ownership changes over time.
        </p>
      </div>
    );
  }

  // Get unique holders across all snapshots (excluding ESOP pool)
  const allHolders = new Map<string, { name: string; type: string }>();
  history.forEach(snapshot => {
    snapshot.ownership.forEach(o => {
      if (o.holderId !== ESOP_POOL_HOLDER_ID) {
        allHolders.set(o.holderId, { name: o.holderName, type: o.holderType });
      }
    });
  });

  // Build chart data
  const chartData = history.map(snapshot => {
    const dataPoint: Record<string, string | number> = {
      date: new Date(snapshot.date).toLocaleDateString('en-GB', { 
        month: 'short', 
        year: '2-digit' 
      }),
      label: snapshot.label,
    };
    
    snapshot.ownership.forEach(o => {
      if (o.holderId !== ESOP_POOL_HOLDER_ID) {
        dataPoint[o.holderName] = o.ownershipPercent;
      }
    });

    // Fill in zeros for holders not in this snapshot
    allHolders.forEach((holder, id) => {
      if (!(holder.name in dataPoint)) {
        dataPoint[holder.name] = 0;
      }
    });

    return dataPoint;
  });

  const holderNames = Array.from(allHolders.values()).map(h => h.name);

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <div className="p-4 bg-charcoal-50 rounded-sm border border-charcoal-100">
        <p className="text-sm text-charcoal-600">
          <strong className="text-charcoal-900">Ownership Evolution</strong> shows how each 
          stakeholder's percentage ownership changes over time as new events (rounds, SAFEs, 
          option grants) occur. ESOP pool is excluded from this view.
        </p>
      </div>

      {/* Area Chart */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-charcoal-900 mb-4">
          Ownership % Over Time
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e7e7" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                stroke="#6d6d6d"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6d6d6d"
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e7e7e7',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              {holderNames.map((name, index) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line Chart */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-charcoal-900 mb-4">
          Individual Ownership Trends
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e7e7" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                stroke="#6d6d6d"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6d6d6d"
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e7e7e7',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              {holderNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ownership Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900">
            Ownership by Event
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Stakeholder</th>
                {history.map(s => (
                  <th key={s.eventId} className="text-right">
                    <div className="text-xs">{s.label}</div>
                    <div className="text-2xs text-charcoal-400 font-normal">
                      {new Date(s.date).toLocaleDateString('en-GB')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holderNames.map(name => (
                <tr key={name}>
                  <td className="font-medium">{name}</td>
                  {history.map(snapshot => {
                    const ownership = snapshot.ownership.find(o => o.holderName === name);
                    return (
                      <td key={snapshot.eventId} className="text-right font-mono">
                        {ownership ? `${ownership.ownershipPercent.toFixed(2)}%` : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

