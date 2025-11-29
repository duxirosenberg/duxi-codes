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
import { AlertTriangle, TrendingUp } from 'lucide-react';
import type { CapTableResponse, EventBase, OwnershipSnapshot } from '../types';
import { PERSON_TYPE_LABELS, ESOP_POOL_HOLDER_ID } from '../types';

interface CapTableViewProps {
  capTable: CapTableResponse | null;
  events: EventBase[];
  ownershipHistory: OwnershipSnapshot[];
  companyId: string;
  currency: string;
}

type TabType = 'legal' | 'fully_diluted' | 'pro_forma' | 'evolution';

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
        </button>
        <button
          onClick={() => setActiveTab('pro_forma')}
          className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
            activeTab === 'pro_forma'
              ? 'bg-white text-charcoal-900 shadow-sm'
              : 'text-charcoal-600 hover:text-charcoal-900'
          }`}
        >
          Pro Forma
          {capTable.fullyDilutedCapTable.unconvertedSAFEs.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              {capTable.fullyDilutedCapTable.unconvertedSAFEs.length}
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
          <FullyDilutedCapTable capTable={capTable} currencySymbol={currencySymbol} />
        )}
        {activeTab === 'pro_forma' && (
          <ProFormaCapTable capTable={capTable} currencySymbol={currencySymbol} />
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

function FullyDilutedCapTable({ capTable, currencySymbol }: { capTable: CapTableResponse; currencySymbol: string }) {
  const { fullyDilutedCapTable, legalCapTable } = capTable;

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
          issued shares plus all options (vested and unvested), unallocated ESOP pool, and 
          assumes all convertible instruments convert. Value is calculated using the latest priced round share price.
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
              {fullyDilutedCapTable.rows.map((row) => {
                const value = latestPricePerShare ? row.totalShares * latestPricePerShare : null;
                return (
                  <tr 
                    key={row.holderId}
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
                        {PERSON_TYPE_LABELS[row.holderType]}
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
                      {row.ownershipPercent}%
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
                  {fullyDilutedCapTable.rows.reduce((sum, r) => sum + r.issuedShares, 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                  {fullyDilutedCapTable.rows.reduce((sum, r) => sum + r.optionShares, 0).toLocaleString()}
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

      {/* Unconverted SAFEs */}
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
                        : '—'}
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
    </div>
  );
}

/**
 * Pro Forma Cap Table - Shows what ownership would look like if SAFEs converted at their caps
 * This is useful for fundraising planning to understand potential dilution
 */
function ProFormaCapTable({ capTable, currencySymbol }: { capTable: CapTableResponse; currencySymbol: string }) {
  const { fullyDilutedCapTable, legalCapTable } = capTable;
  const unconvertedSAFEs = fullyDilutedCapTable.unconvertedSAFEs;
  
  // Calculate pro forma ownership assuming SAFEs convert at their caps
  const proFormaData = useMemo(() => {
    if (unconvertedSAFEs.length === 0) {
      return null;
    }

    // Get current fully diluted shares (excluding SAFEs since they haven't converted)
    const currentFDShares = fullyDilutedCapTable.totalShares;
    
    // Find the highest SAFE cap to use as the implied valuation
    const safesWithCaps = unconvertedSAFEs.filter(s => s.valuationCap);
    if (safesWithCaps.length === 0) {
      return null;
    }
    
    // Get cap values - these might be pre-money or post-money
    const highestCap = Math.max(...safesWithCaps.map(s => Number(s.valuationCap)));
    const lowestCap = Math.min(...safesWithCaps.map(s => Number(s.valuationCap)));
    
    // Total SAFE principal for post-money calculation
    const totalSafePrincipal = unconvertedSAFEs.reduce((sum, s) => sum + Number(s.principalAmount), 0);
    
    // Calculate conversion for each SAFE at a given pre-money cap valuation
    // Returns post-money valuation and all conversion details
    const calculateConversions = (preMoneyCapValuation: number) => {
      // For pre-money SAFEs: Post-money = Pre-money cap + SAFE principal
      // The price per share is based on pre-money cap / pre-round shares
      const impliedPrice = preMoneyCapValuation / currentFDShares;
      
      let totalSafeShares = 0;
      const safeConversions: Array<{
        investorId: string;
        investorName: string;
        principal: number;
        cap: number | null;
        valuationType: string;
        discount: number;
        effectivePrice: number;
        shares: number;
        method: string;
      }> = [];
      
      for (const safe of unconvertedSAFEs) {
        const principal = Number(safe.principalAmount);
        let effectivePrice = impliedPrice;
        let method = 'round_price';
        
        // Cap price calculation depends on SAFE type
        if (safe.valuationCap) {
          let capPrice: number;
          if (safe.valuationType === 'post_money') {
            // Post-money SAFE: ownership = principal / cap
            // So effective price = cap / (shares that give them that ownership)
            // For simplicity, we use the same formula but note it's post-money
            capPrice = Number(safe.valuationCap) / currentFDShares;
          } else {
            // Pre-money SAFE: price = cap / pre-round shares
            capPrice = Number(safe.valuationCap) / currentFDShares;
          }
          
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
          investorId: safe.investorId,
          investorName: safe.investorName || 'Unknown',
          principal,
          cap: safe.valuationCap ? Number(safe.valuationCap) : null,
          valuationType: safe.valuationType || 'pre_money',
          discount: safe.discountPercent || 0,
          effectivePrice,
          shares,
          method
        });
      }
      
      // Calculate post-conversion totals
      const totalSharesAfter = currentFDShares + totalSafeShares;
      
      // Post-money valuation = pre-money + total SAFE investment
      // Or equivalently: total shares × price per share
      const postMoneyValuation = totalSharesAfter * impliedPrice;
      
      // Build pro forma ownership table
      const proFormaRows: Array<{
        holderId: string;
        holderName: string;
        holderType: string;
        currentShares: number;
        safeConversionShares: number;
        totalShares: number;
        currentPercent: number;
        proFormaPercent: number;
        dilution: number;
        value: number;
      }> = [];
      
      // Add existing shareholders
      for (const row of fullyDilutedCapTable.rows) {
        const currentPct = parseFloat(row.ownershipPercent);
        const newPct = (row.totalShares / totalSharesAfter) * 100;
        // Dilution = 1 - (new / old), as a percentage
        // e.g., if you had 50% and now have 40%, dilution = 1 - 40/50 = 20%
        const dilutionPct = currentPct > 0 ? (1 - newPct / currentPct) * 100 : 0;
        
        proFormaRows.push({
          holderId: row.holderId,
          holderName: row.holderName,
          holderType: row.holderType,
          currentShares: row.totalShares,
          safeConversionShares: 0,
          totalShares: row.totalShares,
          currentPercent: currentPct,
          proFormaPercent: newPct,
          dilution: dilutionPct, // Positive = diluted
          value: row.totalShares * impliedPrice
        });
      }
      
      // Add SAFE investors (they're gaining ownership, not being diluted)
      for (const conv of safeConversions) {
        const existingRow = proFormaRows.find(r => r.holderId === conv.investorId);
        if (existingRow) {
          const oldPct = existingRow.currentPercent;
          existingRow.safeConversionShares = conv.shares;
          existingRow.totalShares += conv.shares;
          existingRow.proFormaPercent = (existingRow.totalShares / totalSharesAfter) * 100;
          existingRow.value = existingRow.totalShares * impliedPrice;
          // Recalculate dilution - if they had shares before, check if they're net diluted
          existingRow.dilution = oldPct > 0 ? (1 - existingRow.proFormaPercent / oldPct) * 100 : 0;
        } else {
          // New investor - no dilution concept, they're gaining ownership
          proFormaRows.push({
            holderId: conv.investorId,
            holderName: conv.investorName,
            holderType: 'investor',
            currentShares: 0,
            safeConversionShares: conv.shares,
            totalShares: conv.shares,
            currentPercent: 0,
            proFormaPercent: (conv.shares / totalSharesAfter) * 100,
            dilution: 0, // New investors don't have dilution
            value: conv.shares * impliedPrice
          });
        }
      }
      
      return {
        preMoneyValuation: preMoneyCapValuation,
        postMoneyValuation,
        impliedPrice,
        safeConversions,
        totalSafeShares,
        totalSharesAfter,
        rows: proFormaRows.sort((a, b) => b.proFormaPercent - a.proFormaPercent)
      };
    };
    
    // Calculate for highest cap scenario (pre-money)
    const atHighestCap = calculateConversions(highestCap);
    const atLowestCap = lowestCap !== highestCap ? calculateConversions(lowestCap) : null;
    
    return {
      highestCap,
      lowestCap,
      atHighestCap,
      atLowestCap,
      totalSafePrincipal,
      currentFDShares
    };
  }, [fullyDilutedCapTable, unconvertedSAFEs]);
  
  const [selectedScenario, setSelectedScenario] = useState<'highest' | 'lowest'>('highest');
  
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${currencySymbol}${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `${currencySymbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  if (!proFormaData) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <TrendingUp className="w-12 h-12 text-charcoal-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-charcoal-900 mb-2">
            No Outstanding SAFEs
          </h3>
          <p className="text-charcoal-600 max-w-md mx-auto">
            Pro forma analysis requires outstanding SAFEs with valuation caps. 
            Add SAFE issuance events to see projected ownership if they convert.
          </p>
        </div>
      </div>
    );
  }
  
  const scenario = selectedScenario === 'highest' ? proFormaData.atHighestCap : proFormaData.atLowestCap || proFormaData.atHighestCap;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label">Outstanding SAFEs</div>
          <div className="stat-value">{unconvertedSAFEs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total SAFE Principal</div>
          <div className="stat-value">{formatCurrency(proFormaData.totalSafePrincipal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Highest Cap</div>
          <div className="stat-value">{formatCurrency(proFormaData.highestCap)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Lowest Cap</div>
          <div className="stat-value">{formatCurrency(proFormaData.lowestCap)}</div>
        </div>
      </div>
      
      {/* Explanation */}
      <div className="p-4 bg-amber-50 rounded-sm border border-amber-100 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Pro Forma Analysis</p>
          <p>
            Shows projected ownership if a priced round happens at your SAFE cap valuations. 
            Use this to understand potential dilution and plan your fundraising strategy.
            <strong className="block mt-1">This is a simulation — actual terms may vary.</strong>
          </p>
        </div>
      </div>
      
      {/* Scenario Selector */}
      {proFormaData.atLowestCap && (
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedScenario('highest')}
            className={`px-4 py-2 text-sm font-medium rounded-sm border transition-colors ${
              selectedScenario === 'highest'
                ? 'bg-charcoal-900 text-white border-charcoal-900'
                : 'bg-white text-charcoal-600 border-charcoal-200 hover:border-charcoal-300'
            }`}
          >
            At Highest Cap ({formatCurrency(proFormaData.highestCap)})
          </button>
          <button
            onClick={() => setSelectedScenario('lowest')}
            className={`px-4 py-2 text-sm font-medium rounded-sm border transition-colors ${
              selectedScenario === 'lowest'
                ? 'bg-charcoal-900 text-white border-charcoal-900'
                : 'bg-white text-charcoal-600 border-charcoal-200 hover:border-charcoal-300'
            }`}
          >
            At Lowest Cap ({formatCurrency(proFormaData.lowestCap)})
          </button>
        </div>
      )}
      
      {/* Scenario Details */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-1">
            Pre-Money Cap
          </div>
          <div className="text-xl font-semibold text-charcoal-900">
            {formatCurrency(scenario.preMoneyValuation)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-1">
            Post-Money Valuation
          </div>
          <div className="text-xl font-semibold text-emerald-600">
            {formatCurrency(scenario.postMoneyValuation)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-1">
            Price/Share
          </div>
          <div className="text-xl font-semibold text-charcoal-900">
            {currencySymbol}{scenario.impliedPrice.toFixed(4)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-1">
            Total Shares After
          </div>
          <div className="text-xl font-semibold text-charcoal-900">
            {scenario.totalSharesAfter.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* SAFE Conversion Details */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900">
            SAFE Conversion Details
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-charcoal-50 border-b border-charcoal-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider">Investor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Principal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Cap</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Eff. Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Shares</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[90px]">Own %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[90px]">Method</th>
              </tr>
            </thead>
            <tbody>
              {scenario.safeConversions.map((conv) => (
                <tr key={conv.investorId} className="border-b border-charcoal-100 hover:bg-charcoal-50/50">
                  <td className="px-4 py-3 font-medium">{conv.investorName}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(conv.principal)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {conv.cap ? formatCurrency(conv.cap) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{currencySymbol}{conv.effectivePrice.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{conv.shares.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {((conv.shares / scenario.totalSharesAfter) * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      conv.method === 'cap' 
                        ? 'bg-amber-100 text-amber-700' 
                        : conv.method === 'discount'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-charcoal-100 text-charcoal-600'
                    }`}>
                      {conv.method === 'cap' ? 'At Cap' : conv.method === 'discount' ? 'Discount' : 'Round Price'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-charcoal-50 font-medium">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatCurrency(scenario.safeConversions.reduce((sum, c) => sum + c.principal, 0))}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{scenario.totalSafeShares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {((scenario.totalSafeShares / scenario.totalSharesAfter) * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Pro Forma Ownership Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900">
            Pro Forma Ownership (After SAFE Conversion)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-charcoal-50 border-b border-charcoal-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider">Stakeholder</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[90px]">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Current</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">+ SAFE</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[80px]">Own %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[70px]">Dilution</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-charcoal-500 uppercase tracking-wider w-[100px]">Value</th>
              </tr>
            </thead>
            <tbody>
              {scenario.rows.map((row) => (
                <tr key={row.holderId} className="border-b border-charcoal-100 hover:bg-charcoal-50/50">
                  <td className="px-4 py-3 font-medium">{row.holderName}</td>
                  <td className="px-4 py-3">
                    <span className="badge-default">
                      {PERSON_TYPE_LABELS[row.holderType as keyof typeof PERSON_TYPE_LABELS] || row.holderType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.currentShares > 0 ? row.currentShares.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                    {row.safeConversionShares > 0 ? `+${row.safeConversionShares.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                    {row.totalShares.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {row.proFormaPercent.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${row.dilution > 0 ? 'text-red-600' : ''}`}>
                    {row.currentPercent > 0 && row.dilution > 0 
                      ? `${row.dilution.toFixed(1)}%` 
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-charcoal-50 font-medium">
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {proFormaData.currentFDShares.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                  +{scenario.totalSafeShares.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {scenario.totalSharesAfter.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">100.00%</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                  {formatCurrency(scenario.postMoneyValuation)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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

