import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Info, HelpCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { EventBase, EventType, Person, SAFE } from '../types';
import { EVENT_TYPE_LABELS } from '../types';
import type { CapTableResponse } from '../lib/capTableEngine';

interface EventModalProps {
  companyId: string;
  existingEvent: EventBase | null;
  existingEvents: EventBase[];
  capTable: CapTableResponse | null;
  onSave: (data: Omit<EventBase, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}

export function EventModal({
  companyId,
  existingEvent,
  existingEvents,
  capTable,
  onSave,
  onClose,
}: EventModalProps) {
  // Check if incorporation event exists
  const hasIncorporation = existingEvents.some(e => e.type === 'incorporation');
  
  // Default to null if multiple types available (so user must choose), or 'incorporation' if that's the only option
  const defaultEventType = existingEvent?.type || (!hasIncorporation ? 'incorporation' : null);
  const [eventType, setEventType] = useState<EventType | null>(defaultEventType);
  const [date, setDate] = useState(existingEvent?.date || new Date().toISOString().split('T')[0]);
  const [label, setLabel] = useState(existingEvent?.label || '');
  const [description, setDescription] = useState(existingEvent?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [safes, setSafes] = useState<SAFE[]>([]);

  // Event-specific data
  const [eventData, setEventData] = useState<Record<string, unknown>>(
    existingEvent?.data || {}
  );

  // Load people and SAFEs for the company
  useEffect(() => {
    loadPeopleAndSafes();
  }, [companyId]);

  // Set default label based on event type
  useEffect(() => {
    if (!existingEvent && !label && eventType) {
      setLabel(getDefaultLabel(eventType));
    }
  }, [eventType]);

  const loadPeopleAndSafes = () => {
    // Extract people from cap table state
    if (capTable?.state?.people) {
      setPeople(capTable.state.people);
    }
    // Extract unconverted SAFEs
    if (capTable?.state?.safes) {
      setSafes(capTable.state.safes.filter((s: any) => !s.convertedInEventId));
    }
  };

  const getDefaultLabel = (type: EventType): string => {
    const existingOfType = existingEvents.filter(e => e.type === type).length;
    switch (type) {
      case 'incorporation':
        return 'Incorporation';
      case 'priced_round':
        const rounds = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D'];
        return rounds[existingOfType] || `Series ${String.fromCharCode(65 + existingOfType - 2)}`;
      case 'safe_issuance':
        return `SAFE Round ${existingOfType + 1}`;
      case 'esop_pool_creation':
        return 'ESOP Pool Creation';
      case 'esop_pool_extension':
        return `ESOP Extension ${existingOfType + 1}`;
      case 'esop_grant':
        return `Option Grant ${existingOfType + 1}`;
      case 'option_exercise':
        return `Option Exercise ${existingOfType + 1}`;
      default:
        return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Validate
      if (!eventType) throw new Error('Please select an event type');
      if (!date) throw new Error('Date is required');
      if (!label) throw new Error('Label is required');

      await onSave({
        type: eventType,
        date,
        label,
        description: description || undefined,
        data: eventData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
      setIsSaving(false);
    }
  };

  // Determine available event types
  const availableEventTypes: EventType[] = hasIncorporation
    ? ['priced_round', 'safe_issuance', 'esop_pool_creation', 'esop_pool_extension', 'esop_grant', 'option_exercise']
    : ['incorporation'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-charcoal-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-charcoal-900">
            {existingEvent ? 'Edit Event' : 'Add Event'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event Type Selector */}
          {!existingEvent && (
            <div>
              <label className="input-label">Event Type</label>
              <div className="grid grid-cols-2 gap-2">
                {availableEventTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setEventType(type);
                      setEventData({});
                      setLabel(getDefaultLabel(type));
                    }}
                    className={`p-3 text-left rounded-sm border transition-colors ${
                      eventType === type
                        ? 'border-charcoal-900 bg-charcoal-50'
                        : 'border-charcoal-200 hover:border-charcoal-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-charcoal-900">
                      {EVENT_TYPE_LABELS[type]}
                    </div>
                  </button>
                ))}
              </div>
              {!eventType && availableEventTypes.length > 1 && (
                <p className="mt-2 text-sm text-charcoal-500">
                  Select an event type above to continue
                </p>
              )}
            </div>
          )}

          {/* Only show remaining fields when event type is selected */}
          {eventType && (
            <>
              {/* Common Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Label</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="input"
                    placeholder="e.g., Series A"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Notes about this event..."
                />
              </div>
            </>
          )}

          {/* Event-specific forms */}
          {eventType === 'incorporation' && (
            <IncorporationForm
              data={eventData}
              onChange={setEventData}
            />
          )}
          {eventType === 'priced_round' && (
            <PricedRoundForm
              data={eventData}
              onChange={setEventData}
              people={people}
              safes={safes}
            />
          )}
          {eventType === 'safe_issuance' && (
            <SAFEIssuanceForm
              data={eventData}
              onChange={setEventData}
            />
          )}
          {eventType === 'esop_pool_creation' && (
            <ESOPPoolCreationForm
              data={eventData}
              onChange={setEventData}
            />
          )}
          {eventType === 'esop_pool_extension' && (
            <ESOPPoolExtensionForm
              data={eventData}
              onChange={setEventData}
            />
          )}
          {eventType === 'esop_grant' && (
            <ESOPGrantForm
              data={eventData}
              onChange={setEventData}
              people={people}
            />
          )}
          {eventType === 'option_exercise' && (
            <OptionExerciseForm
              data={eventData}
              onChange={setEventData}
              people={people}
            />
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !eventType} className="btn-primary">
              {isSaving ? 'Saving...' : existingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// EVENT-SPECIFIC FORMS
// =============================================================================

interface FormProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

function IncorporationForm({ data, onChange }: FormProps) {
  const [founderMode, setFounderMode] = useState<'percentage' | 'shares'>(
    (data.founderInputMode as 'percentage' | 'shares') || 'percentage'
  );
  const [founders, setFounders] = useState<Array<{ personId: string; name: string; percentage?: number; shares?: number }>>(
    (data.founders as Array<{ personId: string; name: string; percentage?: number; shares?: number }>) || [
      { personId: uuidv4(), name: '', percentage: 100 }
    ]
  );
  const [totalShares, setTotalShares] = useState(data.totalIssuedShares?.toString() || '10000000');
  const [hasEsop, setHasEsop] = useState(!!(data.esopPool));
  const [esopMode, setEsopMode] = useState<'percentage' | 'shares'>('percentage');
  const [esopValue, setEsopValue] = useState('10');

  useEffect(() => {
    onChange({
      totalIssuedShares: parseInt(totalShares, 10) || 0,
      founderInputMode: founderMode,
      founders,
      pricePerShare: '0.0001',
      ...(hasEsop && {
        esopPool: {
          inputMode: esopMode,
          ...(esopMode === 'percentage' 
            ? { percentage: parseFloat(esopValue) || 0 }
            : { shares: parseInt(esopValue, 10) || 0 })
        }
      })
    });
  }, [totalShares, founderMode, founders, hasEsop, esopMode, esopValue]);

  const addFounder = () => {
    setFounders([...founders, { personId: uuidv4(), name: '', percentage: 0 }]);
  };

  const updateFounder = (index: number, field: string, value: string | number) => {
    const updated = [...founders];
    updated[index] = { ...updated[index], [field]: value };
    setFounders(updated);
  };

  const removeFounder = (index: number) => {
    if (founders.length > 1) {
      setFounders(founders.filter((_, i) => i !== index));
    }
  };

  const totalPercent = founders.reduce((sum, f) => sum + (f.percentage || 0), 0);

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-blue-50 rounded-sm border border-blue-100 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Incorporation Event</p>
          <p>This creates the initial cap table with common shares distributed to founders. 
          You can optionally create an ESOP pool as part of incorporation.</p>
        </div>
      </div>

      <div>
        <label className="input-label">Total Common Shares to Issue</label>
        <input
          type="number"
          value={totalShares}
          onChange={(e) => setTotalShares(e.target.value)}
          className="input"
          placeholder="10,000,000"
        />
        <p className="input-help">These will be distributed among founders</p>
      </div>

      {/* Founders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="input-label mb-0">Founders</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFounderMode('percentage')}
              className={`text-xs px-2 py-1 rounded-sm ${
                founderMode === 'percentage' 
                  ? 'bg-charcoal-900 text-white' 
                  : 'bg-charcoal-100 text-charcoal-600'
              }`}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => setFounderMode('shares')}
              className={`text-xs px-2 py-1 rounded-sm ${
                founderMode === 'shares' 
                  ? 'bg-charcoal-900 text-white' 
                  : 'bg-charcoal-100 text-charcoal-600'
              }`}
            >
              Shares
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {founders.map((founder, index) => (
            <div key={founder.personId} className="flex gap-2">
              <input
                type="text"
                value={founder.name}
                onChange={(e) => updateFounder(index, 'name', e.target.value)}
                className="input flex-1"
                placeholder="Founder name"
              />
              {founderMode === 'percentage' ? (
                <div className="relative w-32">
                  <input
                    type="number"
                    value={founder.percentage || ''}
                    onChange={(e) => updateFounder(index, 'percentage', parseFloat(e.target.value) || 0)}
                    className="input pr-8"
                    placeholder="50"
                    step="0.01"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
                </div>
              ) : (
                <input
                  type="number"
                  value={founder.shares || ''}
                  onChange={(e) => updateFounder(index, 'shares', parseInt(e.target.value, 10) || 0)}
                  className="input w-32"
                  placeholder="5,000,000"
                />
              )}
              <button
                type="button"
                onClick={() => removeFounder(index)}
                className="btn-ghost p-2 text-charcoal-400 hover:text-red-600"
                disabled={founders.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addFounder}
          className="mt-2 text-sm text-charcoal-600 hover:text-charcoal-900 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Founder
        </button>

        {founderMode === 'percentage' && totalPercent !== 100 && (
          <p className={`mt-2 text-sm ${totalPercent > 100 ? 'text-red-600' : 'text-amber-600'}`}>
            Total: {totalPercent.toFixed(2)}% (must equal 100%)
          </p>
        )}
      </div>

      {/* ESOP */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasEsop}
            onChange={(e) => setHasEsop(e.target.checked)}
            className="rounded border-charcoal-300"
          />
          <span className="text-sm text-charcoal-700">Create initial ESOP pool</span>
        </label>

        {hasEsop && (
          <div className="mt-3 p-4 bg-charcoal-50 rounded-sm space-y-3">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setEsopMode('percentage')}
                className={`text-xs px-2 py-1 rounded-sm ${
                  esopMode === 'percentage' 
                    ? 'bg-charcoal-900 text-white' 
                    : 'bg-charcoal-200 text-charcoal-600'
                }`}
              >
                % of Fully Diluted
              </button>
              <button
                type="button"
                onClick={() => setEsopMode('shares')}
                className={`text-xs px-2 py-1 rounded-sm ${
                  esopMode === 'shares' 
                    ? 'bg-charcoal-900 text-white' 
                    : 'bg-charcoal-200 text-charcoal-600'
                }`}
              >
                Fixed Shares
              </button>
            </div>
            <input
              type="number"
              value={esopValue}
              onChange={(e) => setEsopValue(e.target.value)}
              className="input"
              placeholder={esopMode === 'percentage' ? '10' : '1,000,000'}
              step={esopMode === 'percentage' ? '0.1' : '1'}
            />
            <p className="text-xs text-charcoal-500">
              {esopMode === 'percentage' 
                ? 'Pool will be calculated so it equals this % of total fully diluted shares after creation'
                : 'Fixed number of option shares in the pool'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PricedRoundForm({ data, onChange, people, safes }: FormProps & { people: Person[]; safes: SAFE[] }) {
  const [valuationType, setValuationType] = useState<'post_money' | 'pre_money' | 'price_per_share'>(
    (data.valuationInputType as 'post_money' | 'pre_money' | 'price_per_share') || 'post_money'
  );
  const [valuation, setValuation] = useState(
    (data.postMoneyValuation || data.preMoneyValuation || data.pricePerShare || '').toString()
  );
  const [totalNewMoney, setTotalNewMoney] = useState((data.totalNewMoney || '').toString());
  const [investors, setInvestors] = useState<Array<{ personId: string; name: string; amount: string }>>(
    (data.investors as Array<{ personId: string; name: string; amount: string }>) || [
      { personId: uuidv4(), name: '', amount: '' }
    ]
  );
  const [shareClassName, setShareClassName] = useState((data.shareClassName as string) || '');
  const [liquidationPref, setLiquidationPref] = useState((data.liquidationPreference || 1).toString());
  const [participation, setParticipation] = useState((data.participation as string) || 'non_participating');
  const [esopTargetPercent, setEsopTargetPercent] = useState((data.esopTargetPercent || '').toString());
  const [esopTiming, setEsopTiming] = useState<'before_round' | 'after_round'>(
    (data.esopTiming as 'before_round' | 'after_round') || 'before_round'
  );
  const [esopDilutionScope, setEsopDilutionScope] = useState<'all' | 'existing_only'>(
    (data.esopDilutionScope as 'all' | 'existing_only') || 'all'
  );
  const [selectedSafes, setSelectedSafes] = useState<string[]>(
    (data.safesToConvert as string[]) || safes.map(s => s.id)
  );

  useEffect(() => {
    const totalInvestment = investors.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    
    onChange({
      valuationInputType: valuationType,
      ...(valuationType === 'post_money' && { postMoneyValuation: valuation }),
      ...(valuationType === 'pre_money' && { preMoneyValuation: valuation }),
      ...(valuationType === 'price_per_share' && { pricePerShare: valuation }),
      totalNewMoney: totalInvestment.toString(),
      investors,
      createNewShareClass: true,
      shareClassName,
      liquidationPreference: parseFloat(liquidationPref) || 1,
      participation,
      ...(esopTargetPercent && { 
        esopTargetPercent: parseFloat(esopTargetPercent),
        esopTiming,
        esopDilutionScope
      }),
      ...(safes.length > 0 && { safesToConvert: selectedSafes })
    });
  }, [valuationType, valuation, investors, shareClassName, liquidationPref, participation, esopTargetPercent, esopTiming, esopDilutionScope, selectedSafes]);

  const addInvestor = () => {
    setInvestors([...investors, { personId: uuidv4(), name: '', amount: '' }]);
  };

  const updateInvestor = (index: number, field: string, value: string) => {
    const updated = [...investors];
    updated[index] = { ...updated[index], [field]: value };
    setInvestors(updated);
  };

  const removeInvestor = (index: number) => {
    if (investors.length > 1) {
      setInvestors(investors.filter((_, i) => i !== index));
    }
  };

  const totalInvestment = investors.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-emerald-50 rounded-sm border border-emerald-100 flex gap-3">
        <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-800">
          <p className="font-medium mb-1">Priced Equity Round</p>
          <p>Issues new preferred shares to investors at a determined price per share. 
          Outstanding SAFEs will convert into shares as part of this round.</p>
        </div>
      </div>

      {/* Valuation */}
      <div>
        <label className="input-label">Valuation Input Method</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setValuationType('post_money')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              valuationType === 'post_money' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            Post-Money
          </button>
          <button
            type="button"
            onClick={() => setValuationType('pre_money')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              valuationType === 'pre_money' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            Pre-Money
          </button>
          <button
            type="button"
            onClick={() => setValuationType('price_per_share')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              valuationType === 'price_per_share' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            Price/Share
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">$</span>
          <input
            type="number"
            value={valuation}
            onChange={(e) => setValuation(e.target.value)}
            className="input pl-7"
            placeholder={valuationType === 'price_per_share' ? '1.00' : '10,000,000'}
            step={valuationType === 'price_per_share' ? '0.0001' : '1'}
          />
        </div>
        <p className="input-help">
          {valuationType === 'post_money' && 'Post-money = Pre-money + New investment'}
          {valuationType === 'pre_money' && 'Pre-money = Company value before this investment'}
          {valuationType === 'price_per_share' && 'Price per share determines valuation'}
        </p>
      </div>

      {/* Investors */}
      <div>
        <label className="input-label">Investors</label>
        <div className="space-y-2">
          {investors.map((investor, index) => (
            <div key={investor.personId} className="flex gap-2">
              <input
                type="text"
                value={investor.name}
                onChange={(e) => updateInvestor(index, 'name', e.target.value)}
                className="input flex-1"
                placeholder="Investor name"
              />
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">$</span>
                <input
                  type="number"
                  value={investor.amount}
                  onChange={(e) => updateInvestor(index, 'amount', e.target.value)}
                  className="input pl-7"
                  placeholder="1,000,000"
                />
              </div>
              <button
                type="button"
                onClick={() => removeInvestor(index)}
                className="btn-ghost p-2 text-charcoal-400 hover:text-red-600"
                disabled={investors.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={addInvestor}
            className="text-sm text-charcoal-600 hover:text-charcoal-900 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Investor
          </button>
          <span className="text-sm font-mono text-charcoal-600">
            Total: ${totalInvestment.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Share Class */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="input-label">Share Class Name</label>
          <input
            type="text"
            value={shareClassName}
            onChange={(e) => setShareClassName(e.target.value)}
            className="input"
            placeholder="Series Seed"
          />
        </div>
        <div>
          <label className="input-label">Liquidation Preference</label>
          <div className="relative">
            <input
              type="number"
              value={liquidationPref}
              onChange={(e) => setLiquidationPref(e.target.value)}
              className="input pr-8"
              placeholder="1.0"
              step="0.1"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">x</span>
          </div>
        </div>
        <div>
          <label className="input-label">Participation</label>
          <select
            value={participation}
            onChange={(e) => setParticipation(e.target.value)}
            className="select"
          >
            <option value="non_participating">Non-Participating</option>
            <option value="participating">Participating</option>
            <option value="capped_participating">Capped Participating</option>
          </select>
        </div>
      </div>

      {/* ESOP Top-up */}
      <div className="space-y-3">
        <label className="input-label">ESOP Pool Target (Optional)</label>
        <div className="flex items-start gap-4">
          <div className="relative w-28">
            <input
              type="number"
              value={esopTargetPercent}
              onChange={(e) => setEsopTargetPercent(e.target.value)}
              className="input pr-8"
              placeholder="10"
              step="0.1"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
          </div>
          {esopTargetPercent && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-charcoal-500">Timing</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEsopTiming('before_round')}
                    className={`text-xs px-2 py-1 rounded-sm ${
                      esopTiming === 'before_round' 
                        ? 'bg-charcoal-900 text-white' 
                        : 'bg-charcoal-100 text-charcoal-600'
                    }`}
                  >
                    Before Round
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsopTiming('after_round')}
                    className={`text-xs px-2 py-1 rounded-sm ${
                      esopTiming === 'after_round' 
                        ? 'bg-charcoal-900 text-white' 
                        : 'bg-charcoal-100 text-charcoal-600'
                    }`}
                  >
                    After Round
                  </button>
                </div>
              </div>
              {esopTiming === 'after_round' && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-charcoal-500">Dilutes</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEsopDilutionScope('all')}
                      className={`text-xs px-2 py-1 rounded-sm ${
                        esopDilutionScope === 'all' 
                          ? 'bg-charcoal-900 text-white' 
                          : 'bg-charcoal-100 text-charcoal-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setEsopDilutionScope('existing_only')}
                      className={`text-xs px-2 py-1 rounded-sm ${
                        esopDilutionScope === 'existing_only' 
                          ? 'bg-charcoal-900 text-white' 
                          : 'bg-charcoal-100 text-charcoal-600'
                      }`}
                    >
                      Existing Only
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <p className="input-help">
          {esopTiming === 'before_round' 
            ? 'ESOP increase happens before the round — new investors are diluted by it'
            : esopDilutionScope === 'all'
            ? 'ESOP increase happens after the round — dilutes all shareholders equally'
            : 'ESOP increase happens after the round — only existing shareholders are diluted'}
        </p>
      </div>

      {/* SAFE Conversion */}
      {safes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="input-label mb-0">SAFEs Converting in This Round</label>
            <span className="text-xs text-charcoal-500">
              {selectedSafes.length} of {safes.length} selected
            </span>
          </div>
          
          {/* Info about SAFE conversion terms */}
          <div className="p-3 bg-amber-50 rounded-sm border border-amber-100 text-xs text-amber-800">
            <strong>Note:</strong> Converting SAFEs receive the same {shareClassName || 'Preferred'} shares 
            with the same {liquidationPref}x liquidation preference and {participation.replace('_', '-')} participation 
            rights as new investors. Conversion price is the lower of cap price or discount price.
          </div>

          <div className="border border-charcoal-200 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-charcoal-50 text-xs text-charcoal-500 uppercase">
                  <th className="px-3 py-2 text-left font-medium">Convert</th>
                  <th className="px-3 py-2 text-left font-medium">Investor</th>
                  <th className="px-3 py-2 text-right font-medium">Principal</th>
                  <th className="px-3 py-2 text-right font-medium">Cap</th>
                  <th className="px-3 py-2 text-right font-medium">Discount</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {safes.map((safe) => (
                  <tr key={safe.id} className={selectedSafes.includes(safe.id) ? 'bg-emerald-50/50' : ''}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSafes.includes(safe.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSafes([...selectedSafes, safe.id]);
                          } else {
                            setSelectedSafes(selectedSafes.filter(id => id !== safe.id));
                          }
                        }}
                        className="rounded border-charcoal-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{safe.investorName}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      ${Number(safe.principalAmount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {safe.valuationCap ? `$${Number(safe.valuationCap).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {safe.discountPercent ? `${safe.discountPercent}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        safe.valuationType === 'post_money' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {safe.valuationType === 'post_money' ? 'Post' : 'Pre'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-charcoal-50 font-medium">
                  <td colSpan={2} className="px-3 py-2 text-xs uppercase text-charcoal-500">
                    Total Converting
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    ${safes
                      .filter(s => selectedSafes.includes(s.id))
                      .reduce((sum, s) => sum + Number(s.principalAmount), 0)
                      .toLocaleString()}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type SAFEFormItem = {
  id: string;
  investorId: string;
  investorName: string;
  principalAmount: string;
  valuationType: 'pre_money' | 'post_money';
  valuationCap: string;
  discountPercent: string;
  mostFavoredNation: boolean;
  notes: string;
};

function SAFEIssuanceForm({ data, onChange }: FormProps) {
  const [safes, setSafes] = useState<SAFEFormItem[]>(
    (data.safes as SAFEFormItem[]) || [{
      id: uuidv4(),
      investorId: uuidv4(),
      investorName: '',
      principalAmount: '',
      valuationType: 'post_money',
      valuationCap: '',
      discountPercent: '',
      mostFavoredNation: false,
      notes: ''
    }]
  );

  useEffect(() => {
    onChange({ safes });
  }, [safes]);

  const addSafe = () => {
    setSafes([...safes, {
      id: uuidv4(),
      investorId: uuidv4(),
      investorName: '',
      principalAmount: '',
      valuationType: 'post_money',
      valuationCap: '',
      discountPercent: '',
      mostFavoredNation: false,
      notes: ''
    }]);
  };

  const updateSafe = (index: number, field: string, value: string | boolean) => {
    const updated = [...safes];
    updated[index] = { ...updated[index], [field]: value };
    setSafes(updated);
  };

  const removeSafe = (index: number) => {
    if (safes.length > 1) {
      setSafes(safes.filter((_: SAFEFormItem, i: number) => i !== index));
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-4 bg-amber-50 rounded-sm border border-amber-100 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">SAFE Issuance</p>
          <p>Simple Agreement for Future Equity. SAFEs don't immediately create shares but convert 
          into equity during the next priced round, typically at a discount or capped valuation.</p>
        </div>
      </div>

      {safes.map((safe: SAFEFormItem, index: number) => (
        <div key={safe.id} className="p-4 border border-charcoal-200 rounded-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-charcoal-900">SAFE #{index + 1}</h4>
            {safes.length > 1 && (
              <button
                type="button"
                onClick={() => removeSafe(index)}
                className="btn-ghost p-1 text-charcoal-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Investor Name</label>
              <input
                type="text"
                value={safe.investorName}
                onChange={(e) => updateSafe(index, 'investorName', e.target.value)}
                className="input"
                placeholder="Investor name"
              />
            </div>
            <div>
              <label className="input-label">Investment Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">$</span>
                <input
                  type="number"
                  value={safe.principalAmount}
                  onChange={(e) => updateSafe(index, 'principalAmount', e.target.value)}
                  className="input pl-7"
                  placeholder="100,000"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="input-label">SAFE Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSafe(index, 'valuationType', 'post_money')}
                className={`text-xs px-3 py-1.5 rounded-sm ${
                  safe.valuationType === 'post_money' 
                    ? 'bg-charcoal-900 text-white' 
                    : 'bg-charcoal-100 text-charcoal-600'
                }`}
              >
                Post-Money
              </button>
              <button
                type="button"
                onClick={() => updateSafe(index, 'valuationType', 'pre_money')}
                className={`text-xs px-3 py-1.5 rounded-sm ${
                  safe.valuationType === 'pre_money' 
                    ? 'bg-charcoal-900 text-white' 
                    : 'bg-charcoal-100 text-charcoal-600'
                }`}
              >
                Pre-Money
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Valuation Cap (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">$</span>
                <input
                  type="number"
                  value={safe.valuationCap}
                  onChange={(e) => updateSafe(index, 'valuationCap', e.target.value)}
                  className="input pl-7"
                  placeholder="10,000,000"
                />
              </div>
            </div>
            <div>
              <label className="input-label">Discount (Optional)</label>
              <div className="relative">
                <input
                  type="number"
                  value={safe.discountPercent}
                  onChange={(e) => updateSafe(index, 'discountPercent', e.target.value)}
                  className="input pr-8"
                  placeholder="20"
                  step="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={safe.mostFavoredNation}
              onChange={(e) => updateSafe(index, 'mostFavoredNation', e.target.checked)}
              className="rounded border-charcoal-300"
            />
            <span className="text-sm text-charcoal-700">Most Favored Nation (MFN) clause</span>
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addSafe}
        className="text-sm text-charcoal-600 hover:text-charcoal-900 flex items-center gap-1"
      >
        <Plus className="w-4 h-4" />
        Add Another SAFE
      </button>
    </div>
  );
}

function ESOPPoolCreationForm({ data, onChange }: FormProps) {
  const [mode, setMode] = useState<'percentage' | 'shares'>(
    (data.inputMode as 'percentage' | 'shares') || 'percentage'
  );
  const [value, setValue] = useState((data.percentage || data.shares || '10').toString());

  useEffect(() => {
    onChange({
      inputMode: mode,
      ...(mode === 'percentage' 
        ? { percentage: parseFloat(value) || 0 }
        : { shares: parseInt(value, 10) || 0 })
    });
  }, [mode, value]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-sm border border-blue-100 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">ESOP Pool Creation</p>
          <p>Creates an option pool for employee equity grants. The pool dilutes all existing 
          shareholders proportionally.</p>
        </div>
      </div>

      <div>
        <label className="input-label">Pool Size Method</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('percentage')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              mode === 'percentage' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            % of Fully Diluted
          </button>
          <button
            type="button"
            onClick={() => setMode('shares')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              mode === 'shares' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            Fixed Shares
          </button>
        </div>
        <div className="relative w-48">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`input ${mode === 'percentage' ? 'pr-8' : ''}`}
            placeholder={mode === 'percentage' ? '10' : '1,000,000'}
            step={mode === 'percentage' ? '0.1' : '1'}
          />
          {mode === 'percentage' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
          )}
        </div>
        <p className="input-help">
          {mode === 'percentage' 
            ? 'Pool = ExistingShares × (Target% / (100% - Target%))'
            : 'Fixed number of options to create'}
        </p>
      </div>
    </div>
  );
}

function ESOPPoolExtensionForm({ data, onChange }: FormProps) {
  const [targetPercent, setTargetPercent] = useState((data.targetPercent || '10').toString());

  useEffect(() => {
    onChange({ targetPercent: parseFloat(targetPercent) || 0 });
  }, [targetPercent]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-sm border border-blue-100 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">ESOP Pool Extension</p>
          <p>Increases the option pool to a target percentage. This is typically done before 
          or as part of a funding round.</p>
        </div>
      </div>

      <div>
        <label className="input-label">Target Pool Percentage</label>
        <div className="relative w-48">
          <input
            type="number"
            value={targetPercent}
            onChange={(e) => setTargetPercent(e.target.value)}
            className="input pr-8"
            placeholder="10"
            step="0.1"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
        </div>
        <p className="input-help">
          Pool will be expanded so unallocated options equal this % of fully diluted shares
        </p>
      </div>
    </div>
  );
}

function ESOPGrantForm({ data, onChange, people }: FormProps & { people: Person[] }) {
  const [employeeId, setEmployeeId] = useState((data.employeeId as string) || uuidv4());
  const [employeeName, setEmployeeName] = useState((data.employeeName as string) || '');
  const [grantMode, setGrantMode] = useState<'shares' | 'percentage'>(
    (data.grantMode as 'shares' | 'percentage') || 'shares'
  );
  const [shares, setShares] = useState((data.shares || '').toString());
  const [percentage, setPercentage] = useState((data.percentage || '').toString());
  const [strikePrice, setStrikePrice] = useState((data.strikePrice || '').toString());
  const [vestingStartDate, setVestingStartDate] = useState((data.vestingStartDate as string) || '');
  const [hasVesting, setHasVesting] = useState(true);
  const [cliffMonths, setCliffMonths] = useState('12');
  const [totalMonths, setTotalMonths] = useState('48');
  const [cliffPercent, setCliffPercent] = useState('25');

  const employees = people.filter(p => p.type === 'employee' || p.type === 'advisor');

  useEffect(() => {
    onChange({
      employeeId,
      employeeName,
      grantMode,
      ...(grantMode === 'shares' 
        ? { shares: parseInt(shares, 10) || 0 }
        : { percentage: parseFloat(percentage) || 0 }
      ),
      strikePrice,
      vestingStartDate: vestingStartDate || undefined,
      ...(hasVesting && {
        vestingSchedule: {
          description: `${totalMonths} months, ${cliffMonths} month cliff`,
          cliffMonths: parseInt(cliffMonths, 10) || 12,
          totalMonths: parseInt(totalMonths, 10) || 48,
          vestingFrequency: 'monthly',
          initialCliffPercent: parseFloat(cliffPercent) || 25
        }
      })
    });
  }, [employeeId, employeeName, grantMode, shares, percentage, strikePrice, vestingStartDate, hasVesting, cliffMonths, totalMonths, cliffPercent]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-purple-50 rounded-sm border border-purple-100 flex gap-3">
        <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-purple-800">
          <p className="font-medium mb-1">Option Grant</p>
          <p>Grants options from the ESOP pool to an employee. Options typically vest over 
          time with a cliff period.</p>
        </div>
      </div>

      <div>
        <label className="input-label">Employee/Grantee</label>
        <input
          type="text"
          value={employeeName}
          onChange={(e) => {
            setEmployeeName(e.target.value);
            setEmployeeId(uuidv4());
          }}
          className="input"
          placeholder="Employee name"
          list="employees"
        />
        <datalist id="employees">
          {employees.map(p => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </div>

      <div>
        <label className="input-label">Grant Amount</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setGrantMode('shares')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              grantMode === 'shares' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            Fixed Shares
          </button>
          <button
            type="button"
            onClick={() => setGrantMode('percentage')}
            className={`text-xs px-3 py-1.5 rounded-sm ${
              grantMode === 'percentage' 
                ? 'bg-charcoal-900 text-white' 
                : 'bg-charcoal-100 text-charcoal-600'
            }`}
          >
            % of Company
          </button>
        </div>
        {grantMode === 'shares' ? (
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="input"
            placeholder="10,000"
          />
        ) : (
          <div className="relative w-40">
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="input pr-8"
              placeholder="0.3"
              step="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
          </div>
        )}
        <p className="input-help">
          {grantMode === 'shares' 
            ? 'Fixed number of options to grant'
            : 'Percentage of fully diluted shares (will be converted to shares at grant time)'
          }
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Strike Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-sm">$</span>
            <input
              type="number"
              value={strikePrice}
              onChange={(e) => setStrikePrice(e.target.value)}
              className="input pl-7"
              placeholder="0.10"
              step="0.0001"
            />
          </div>
        </div>
        <div>
          <label className="input-label">Vesting Start Date</label>
          <input
            type="date"
            value={vestingStartDate}
            onChange={(e) => setVestingStartDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={hasVesting}
            onChange={(e) => setHasVesting(e.target.checked)}
            className="rounded border-charcoal-300"
          />
          <span className="text-sm text-charcoal-700">Include vesting schedule</span>
        </label>

        {hasVesting && (
          <div className="p-4 bg-charcoal-50 rounded-sm grid grid-cols-3 gap-4">
            <div>
              <label className="input-label">Total Vesting Period</label>
              <div className="relative">
                <input
                  type="number"
                  value={totalMonths}
                  onChange={(e) => setTotalMonths(e.target.value)}
                  className="input pr-16"
                  placeholder="48"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-xs">months</span>
              </div>
            </div>
            <div>
              <label className="input-label">Cliff Period</label>
              <div className="relative">
                <input
                  type="number"
                  value={cliffMonths}
                  onChange={(e) => setCliffMonths(e.target.value)}
                  className="input pr-16"
                  placeholder="12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 text-xs">months</span>
              </div>
            </div>
            <div>
              <label className="input-label">Cliff Vesting %</label>
              <div className="relative">
                <input
                  type="number"
                  value={cliffPercent}
                  onChange={(e) => setCliffPercent(e.target.value)}
                  className="input pr-8"
                  placeholder="25"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400">%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionExerciseForm({ data, onChange, people }: FormProps & { people: Person[] }) {
  const [employeeId, setEmployeeId] = useState((data.employeeId as string) || '');
  const [shares, setShares] = useState((data.shares || '').toString());

  const employees = people.filter(p => p.type === 'employee' || p.type === 'advisor');

  useEffect(() => {
    onChange({
      employeeId,
      shares: parseInt(shares, 10) || 0
    });
  }, [employeeId, shares]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-teal-50 rounded-sm border border-teal-100 flex gap-3">
        <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-teal-800">
          <p className="font-medium mb-1">Option Exercise</p>
          <p>Employee exercises vested options by paying the strike price to convert options 
          into common shares.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="input-label">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="select"
          >
            <option value="">Select employee...</option>
            {employees.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Options to Exercise</label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            className="input"
            placeholder="1,000"
          />
        </div>
      </div>
    </div>
  );
}

