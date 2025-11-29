import { motion } from 'framer-motion';
import {
  Building,
  Coins,
  FileText,
  Users,
  TrendingUp,
  Award,
  Play,
  Trash2,
  Edit,
  ChevronRight,
} from 'lucide-react';
import type { EventBase, CapTableState, EventType } from '../types';
import { EVENT_TYPE_LABELS } from '../types';

interface TimelineProps {
  events: EventBase[];
  selectedEvent: EventBase | null;
  onSelectEvent: (event: EventBase | null) => void;
  onEditEvent: (event: EventBase) => void;
  onDeleteEvent: (eventId: string) => void;
  capTableState: CapTableState | null;
  currency?: string;
}

const eventIcons: Record<EventType, typeof Building> = {
  incorporation: Building,
  priced_round: Coins,
  safe_issuance: FileText,
  esop_pool_creation: Users,
  esop_pool_extension: TrendingUp,
  esop_grant: Award,
  option_exercise: Play,
};

const eventColors: Record<EventType, string> = {
  incorporation: 'bg-charcoal-900 text-white',
  priced_round: 'bg-emerald-500 text-white',
  safe_issuance: 'bg-amber-500 text-white',
  esop_pool_creation: 'bg-blue-500 text-white',
  esop_pool_extension: 'bg-blue-400 text-white',
  esop_grant: 'bg-purple-500 text-white',
  option_exercise: 'bg-teal-500 text-white',
};

export function Timeline({
  events,
  selectedEvent,
  onSelectEvent,
  onEditEvent,
  onDeleteEvent,
  currency = 'USD',
}: TimelineProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getEventSummary = (event: EventBase) => {
    const data = event.data as Record<string, unknown>;
    
    switch (event.type) {
      case 'incorporation':
        return `${Number(data.totalIssuedShares || 0).toLocaleString()} shares issued`;
      case 'priced_round':
        return `${formatCurrency(data.totalNewMoney as string)} raised`;
      case 'safe_issuance': {
        const safes = (data.safes as Array<{principalAmount: string}>) || [];
        const total = safes.reduce((sum, s) => sum + Number(s.principalAmount || 0), 0);
        return `${formatCurrency(total)} in SAFEs`;
      }
      case 'esop_pool_creation':
        return data.inputMode === 'percentage' 
          ? `${data.percentage}% pool created`
          : `${Number(data.shares || 0).toLocaleString()} options`;
      case 'esop_pool_extension':
        return `Extended to ${data.targetPercent}%`;
      case 'esop_grant':
        return `${Number(data.shares || 0).toLocaleString()} options to ${data.employeeName}`;
      case 'option_exercise':
        return `${Number(data.shares || 0).toLocaleString()} options exercised`;
      default:
        return '';
    }
  };

  if (events.length === 0) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card">
          <div className="p-8 text-center border-b border-charcoal-100">
            <div className="w-14 h-14 rounded-sm bg-charcoal-900 flex items-center justify-center mx-auto mb-4">
              <Building className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-charcoal-900 mb-2">
              Start with Incorporation
            </h3>
            <p className="text-sm text-charcoal-600 max-w-sm mx-auto">
              Set up your initial cap table by adding an <strong>Incorporation</strong> event 
              with founder allocations and optionally an ESOP pool.
            </p>
          </div>
          
          <div className="p-5 bg-charcoal-50/50">
            <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wider mb-3">
              Typical event sequence
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 bg-white rounded-sm border border-charcoal-200">
                <span className="w-6 h-6 rounded-sm bg-charcoal-900 flex items-center justify-center text-white text-xs font-medium">1</span>
                <span className="text-sm text-charcoal-700">Incorporation — issue founder shares</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-sm border border-charcoal-100 border-dashed">
                <span className="w-6 h-6 rounded-sm bg-charcoal-200 flex items-center justify-center text-charcoal-500 text-xs font-medium">2</span>
                <span className="text-sm text-charcoal-500">SAFE notes from angels</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-sm border border-charcoal-100 border-dashed">
                <span className="w-6 h-6 rounded-sm bg-charcoal-200 flex items-center justify-center text-charcoal-500 text-xs font-medium">3</span>
                <span className="text-sm text-charcoal-500">Priced seed round (SAFEs convert)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-sm border border-charcoal-100 border-dashed">
                <span className="w-6 h-6 rounded-sm bg-charcoal-200 flex items-center justify-center text-charcoal-500 text-xs font-medium">4</span>
                <span className="text-sm text-charcoal-500">Option grants, Series A, etc.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-0">
        {events.map((event, index) => {
          const Icon = eventIcons[event.type] || Building;
          const isSelected = selectedEvent?.id === event.id;
          
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="timeline-item"
            >
              {/* Timeline dot */}
              <div className={`timeline-dot ${isSelected ? 'active' : ''}`}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              {/* Event card */}
              <div
                className={`card cursor-pointer transition-all duration-150 ${
                  isSelected 
                    ? 'ring-2 ring-charcoal-900 ring-offset-2' 
                    : 'hover:shadow-soft'
                }`}
                onClick={() => onSelectEvent(isSelected ? null : event)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${eventColors[event.type]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-charcoal-900">
                            {event.label}
                          </h3>
                          <span className="badge-default">
                            {EVENT_TYPE_LABELS[event.type]}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal-500 mt-0.5">
                          {formatDate(event.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-charcoal-700">
                        {getEventSummary(event)}
                      </p>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-charcoal-100"
                    >
                      {event.description && (
                        <p className="text-sm text-charcoal-600 mb-4">
                          {event.description}
                        </p>
                      )}
                      
                      <EventDetails event={event} currency={currency} />

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-charcoal-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(event);
                          }}
                          className="btn-secondary btn-sm"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this event?')) {
                              onDeleteEvent(event.id);
                            }
                          }}
                          className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function EventDetails({ event, currency = 'USD' }: { event: EventBase; currency?: string }) {
  const data = event.data as Record<string, unknown>;
  
  const formatMoney = (amount: string | number, decimals = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(amount));
  };

  switch (event.type) {
    case 'incorporation':
      return (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Total Shares</p>
            <p className="font-mono">{Number(data.totalIssuedShares || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Founders</p>
            <p className="font-mono">{((data.founders as unknown[]) || []).length}</p>
          </div>
          {data.esopPool ? (
            <div className="col-span-2">
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Initial ESOP Pool</p>
              <p className="font-mono">
                {(data.esopPool as {inputMode: string; percentage?: number; shares?: number}).inputMode === 'percentage'
                  ? `${(data.esopPool as {percentage: number}).percentage}% of fully diluted`
                  : `${Number((data.esopPool as {shares: number}).shares).toLocaleString()} options`}
              </p>
            </div>
          ) : null}
        </div>
      );

    case 'priced_round':
      return (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Amount Raised</p>
              <p className="font-mono">{formatMoney(Number(data.totalNewMoney) || 0)}</p>
            </div>
            <div>
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Valuation Type</p>
              <p className="font-mono capitalize">{String(data.valuationInputType || 'post_money').replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">
                {data.valuationInputType === 'pre_money' ? 'Pre-Money' : 'Post-Money'}
              </p>
              <p className="font-mono">
                {formatMoney(Number(data.postMoneyValuation || data.preMoneyValuation) || 0)}
              </p>
            </div>
          </div>
          
          {data.investors && (data.investors as unknown[]).length > 0 ? (
            <div>
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-2">Investors</p>
              <div className="space-y-1">
                {(data.investors as Array<{name: string; amount: string}>).map((inv, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>{inv.name}</span>
                    <span className="font-mono">{formatMoney(inv.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );

    case 'safe_issuance':
      return (
        <div className="space-y-2 text-sm">
          <p className="text-charcoal-500 text-xs uppercase tracking-wider">SAFEs Issued</p>
          {(data.safes as Array<{investorName: string; principalAmount: string; valuationType: string; valuationCap?: string; discountPercent?: number}>)?.map((safe, i) => (
            <div key={i} className="p-3 bg-charcoal-50 rounded-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{safe.investorName}</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">
                    {safe.valuationType === 'post_money' ? 'Post-Money' : 'Pre-Money'} SAFE
                    {safe.valuationCap && ` • ${formatMoney(safe.valuationCap)} cap`}
                    {safe.discountPercent && ` • ${safe.discountPercent}% discount`}
                  </p>
                </div>
                <p className="font-mono">{formatMoney(safe.principalAmount)}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case 'esop_grant':
      return (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Grantee</p>
            <p>{String(data.employeeName)}</p>
          </div>
          <div>
            <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Options</p>
            <p className="font-mono">{Number(data.shares || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Strike Price</p>
            <p className="font-mono">{formatMoney(Number(data.strikePrice) || 0, 4)}</p>
          </div>
          {data.vestingSchedule ? (
            <div>
              <p className="text-charcoal-500 text-xs uppercase tracking-wider mb-1">Vesting</p>
              <p>
                {(data.vestingSchedule as {totalMonths: number}).totalMonths} months,{' '}
                {(data.vestingSchedule as {cliffMonths: number}).cliffMonths} month cliff
              </p>
            </div>
          ) : null}
        </div>
      );

    default:
      return (
        <pre className="text-xs bg-charcoal-50 p-3 rounded-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}

