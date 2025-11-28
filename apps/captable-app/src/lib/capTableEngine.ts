/**
 * Cap Table Engine - Client-Side TypeScript Port
 * 
 * This is the core business logic for processing events and computing cap table state.
 * All state changes are deterministic and derived from the ordered list of events.
 */

import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  EventBase,
  EventType,
  PersonType,
  ShareClassType,
  CapTableState,
  SecurityHolding,
  SAFE,
  LegalCapTable,
  LegalCapTableRow,
  FullyDilutedCapTable,
  FullyDilutedCapTableRow,
  ExitWaterfall,
  ExitDistribution,
  OwnershipSnapshot,
} from '../types';

// Configure Decimal.js for high precision
Decimal.set({ 
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP
});

// =============================================================================
// CONSTANTS
// =============================================================================

export const ESOP_POOL_HOLDER_ID = '__esop_pool__';

const EVENT_TYPES: Record<string, EventType> = {
  INCORPORATION: 'incorporation',
  PRICED_ROUND: 'priced_round',
  SAFE_ISSUANCE: 'safe_issuance',
  ESOP_POOL_CREATION: 'esop_pool_creation',
  ESOP_POOL_EXTENSION: 'esop_pool_extension',
  ESOP_GRANT: 'esop_grant',
  OPTION_EXERCISE: 'option_exercise'
};

const PERSON_TYPES: Record<string, PersonType> = {
  FOUNDER: 'founder',
  EMPLOYEE: 'employee',
  ADVISOR: 'advisor',
  INVESTOR: 'investor',
  OTHER: 'other',
  ESOP_POOL: 'esop_pool'
};

const SHARE_CLASS_TYPES: Record<string, ShareClassType> = {
  COMMON: 'common',
  PREFERRED: 'preferred',
  OPTION: 'option'
};

// =============================================================================
// DECIMAL UTILITIES
// =============================================================================

function toDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

function roundShares(shares: Decimal): number {
  return shares.round().toNumber();
}

function distributeSharesByLargestRemainder(
  totalShares: number,
  recipients: { id: string; proportion: Decimal }[]
): { id: string; shares: number }[] {
  const total = toDecimal(totalShares);
  
  const exactShares = recipients.map(r => ({
    id: r.id,
    exact: total.times(r.proportion),
    floor: 0,
    remainder: new Decimal(0)
  }));
  
  exactShares.forEach(r => {
    r.floor = r.exact.floor().toNumber();
    r.remainder = r.exact.minus(r.floor);
  });
  
  let distributed = exactShares.reduce((sum, r) => sum + r.floor, 0);
  let remaining = totalShares - distributed;
  
  const sorted = [...exactShares].sort((a, b) => 
    b.remainder.minus(a.remainder).toNumber()
  );
  
  const result = new Map(exactShares.map(r => [r.id, r.floor]));
  
  for (let i = 0; i < remaining && i < sorted.length; i++) {
    const current = result.get(sorted[i].id) || 0;
    result.set(sorted[i].id, current + 1);
  }
  
  return recipients.map(r => ({
    id: r.id,
    shares: result.get(r.id) || 0
  }));
}

function calculateESOPPoolFromPercent(existingShares: number | string | Decimal, targetPercent: number): number {
  const existing = toDecimal(existingShares);
  const p = toDecimal(targetPercent);
  
  if (p.gte(1)) {
    throw new Error('Target ESOP percentage must be less than 100%');
  }
  
  const pool = existing.times(p).div(toDecimal(1).minus(p));
  return roundShares(pool);
}

function calculateESOPExtension(
  currentFullyDiluted: number | string | Decimal,
  currentPoolSize: number | string | Decimal,
  targetPercent: number
): number {
  const totalFD = toDecimal(currentFullyDiluted);
  const currentPool = toDecimal(currentPoolSize);
  const p = toDecimal(targetPercent);
  
  const nonPoolShares = totalFD.minus(currentPool);
  const targetPool = nonPoolShares.times(p).div(toDecimal(1).minus(p));
  const extension = targetPool.minus(currentPool);
  
  return Math.max(0, roundShares(extension));
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

export function createInitialState(companyId: string): CapTableState {
  return {
    companyId,
    asOfEventId: null,
    asOfDate: null,
    shareClasses: [],
    holdings: [],
    safes: [],
    people: [],
    vestingSchedules: []
  };
}

function cloneState(state: CapTableState): CapTableState {
  return JSON.parse(JSON.stringify(state));
}

// =============================================================================
// MAIN ENTRY POINTS
// =============================================================================

export function applyEvent(state: CapTableState, event: EventBase): CapTableState {
  const newState = cloneState(state);
  newState.asOfEventId = event.id;
  newState.asOfDate = event.date;

  switch (event.type) {
    case EVENT_TYPES.INCORPORATION:
      return applyIncorporation(newState, event);
    case EVENT_TYPES.PRICED_ROUND:
      return applyPricedRound(newState, event);
    case EVENT_TYPES.SAFE_ISSUANCE:
      return applySAFEIssuance(newState, event);
    case EVENT_TYPES.ESOP_POOL_CREATION:
      return applyESOPPoolCreation(newState, event);
    case EVENT_TYPES.ESOP_POOL_EXTENSION:
      return applyESOPPoolExtension(newState, event);
    case EVENT_TYPES.ESOP_GRANT:
      return applyESOPGrant(newState, event);
    case EVENT_TYPES.OPTION_EXERCISE:
      return applyOptionExercise(newState, event);
    default:
      throw new Error(`Unknown event type: ${event.type}`);
  }
}

export function replayAllEvents(companyId: string, events: EventBase[]): {
  finalState: CapTableState;
  snapshots: { eventId: string; date: string; label: string; state: CapTableState }[];
} {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let state = createInitialState(companyId);
  const snapshots: { eventId: string; date: string; label: string; state: CapTableState }[] = [];

  for (const event of sortedEvents) {
    state = applyEvent(state, event);
    snapshots.push({
      eventId: event.id,
      date: event.date,
      label: event.label,
      state: cloneState(state)
    });
  }

  return { finalState: state, snapshots };
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function applyIncorporation(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  const commonClassId = uuidv4();
  state.shareClasses.push({
    id: commonClassId,
    name: 'Common',
    type: SHARE_CLASS_TYPES.COMMON as ShareClassType,
    seniorityRank: 0,
    liquidationPreferenceMultiple: 1.0,
    participation: 'non_participating',
    isConvertibleToCommon: false,
    pricePerShare: data.pricePerShare || '0.0001'
  });

  if (data.esopPool) {
    state.people.push({
      id: ESOP_POOL_HOLDER_ID,
      name: 'ESOP Pool (Unallocated)',
      type: PERSON_TYPES.ESOP_POOL as PersonType
    });
  }

  const founders = data.founders || [];
  const totalFounderShares = toDecimal(data.totalIssuedShares);
  
  let founderAllocations: { personId: string; shares: number }[];
  if (data.founderInputMode === 'percentage') {
    const allocations = founders.map((f: any) => ({
      id: f.personId,
      proportion: toDecimal(f.percentage).div(100)
    }));
    
    const distribution = distributeSharesByLargestRemainder(
      roundShares(totalFounderShares),
      allocations
    );
    
    founderAllocations = distribution.map(d => ({
      personId: d.id,
      shares: d.shares
    }));
  } else {
    founderAllocations = founders.map((f: any) => ({
      personId: f.personId,
      shares: parseInt(f.shares, 10)
    }));
  }

  for (const founder of founders) {
    if (!state.people.find(p => p.id === founder.personId)) {
      state.people.push({
        id: founder.personId,
        name: founder.name,
        type: PERSON_TYPES.FOUNDER as PersonType
      });
    }
    
    const allocation = founderAllocations.find(a => a.personId === founder.personId);
    state.holdings.push({
      id: uuidv4(),
      holderId: founder.personId,
      shareClassId: commonClassId,
      quantity: String(allocation?.shares || 0),
      sourceEventId: event.id,
      isOption: false
    });
  }

  if (data.esopPool) {
    const optionClassId = uuidv4();
    state.shareClasses.push({
      id: optionClassId,
      name: 'Employee Options',
      type: SHARE_CLASS_TYPES.OPTION as ShareClassType,
      seniorityRank: 0,
      liquidationPreferenceMultiple: 0,
      participation: 'non_participating',
      isConvertibleToCommon: true
    });

    let esopShares: number;
    if (data.esopPool.inputMode === 'percentage') {
      const founderTotal = founderAllocations.reduce((sum, f) => sum + f.shares, 0);
      esopShares = calculateESOPPoolFromPercent(founderTotal, data.esopPool.percentage / 100);
    } else {
      esopShares = parseInt(data.esopPool.shares, 10);
    }

    state.holdings.push({
      id: uuidv4(),
      holderId: ESOP_POOL_HOLDER_ID,
      shareClassId: optionClassId,
      quantity: String(esopShares),
      sourceEventId: event.id,
      isOption: true
    });
  }

  return state;
}

function applyPricedRound(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  const preRoundMetrics = calculatePreRoundMetrics(state);
  const preRoundFD = toDecimal(preRoundMetrics.fullyDilutedShares);
  
  const safesToConvert = data.safesToConvert || state.safes.filter((s: SAFE) => !s.convertedInEventId).map((s: SAFE) => s.id);
  const convertingSafes = safesToConvert
    .map((id: string) => state.safes.find((s: SAFE) => s.id === id))
    .filter((s: SAFE | undefined): s is SAFE => !!s && !s.convertedInEventId);
  
  let pricePerShare: Decimal;
  let postMoneyValuation: Decimal;
  
  const totalCashInvestment = toDecimal(data.totalNewMoney);
  
  if (data.valuationInputType === 'price_per_share') {
    pricePerShare = toDecimal(data.pricePerShare);
    const newShares = totalCashInvestment.div(pricePerShare);
    postMoneyValuation = preRoundFD.plus(newShares).times(pricePerShare);
    
  } else if (data.valuationInputType === 'pre_money') {
    const preMoney = toDecimal(data.preMoneyValuation);
    pricePerShare = preMoney.div(preRoundFD);
    postMoneyValuation = preMoney.plus(totalCashInvestment);
    
  } else {
    postMoneyValuation = toDecimal(data.postMoneyValuation);
    pricePerShare = postMoneyValuation.minus(totalCashInvestment).div(preRoundFD);
    
    // Iterate to converge on correct price with SAFE conversions
    for (let iter = 0; iter < 10; iter++) {
      let totalNewShares = totalCashInvestment.div(pricePerShare);
      let totalSafeSharesCalc = new Decimal(0);
      
      for (const safe of convertingSafes) {
        const principal = toDecimal(safe.principalAmount);
        
        if (safe.valuationType === 'post_money' && safe.valuationCap) {
          const cap = toDecimal(safe.valuationCap);
          const ownershipPercent = principal.div(cap);
          const totalSharesEstimate = preRoundFD.plus(totalNewShares).plus(totalSafeSharesCalc);
          const safeShares = totalSharesEstimate.times(ownershipPercent).div(
            new Decimal(1).minus(ownershipPercent)
          );
          totalSafeSharesCalc = totalSafeSharesCalc.plus(safeShares);
        } else {
          let effectivePrice = pricePerShare;
          if (safe.valuationCap) {
            const capPrice = toDecimal(safe.valuationCap).div(preRoundFD);
            if (capPrice.lt(pricePerShare)) {
              effectivePrice = capPrice;
            }
          }
          if (safe.discountPercent && safe.discountPercent > 0) {
            const discountPrice = pricePerShare.times(1 - safe.discountPercent / 100);
            if (discountPrice.lt(effectivePrice)) {
              effectivePrice = discountPrice;
            }
          }
          const safeShares = principal.div(effectivePrice);
          totalSafeSharesCalc = totalSafeSharesCalc.plus(safeShares);
        }
      }
      
      const totalSharesAfter = preRoundFD.plus(totalNewShares).plus(totalSafeSharesCalc);
      const newPrice = postMoneyValuation.div(totalSharesAfter);
      
      if (newPrice.minus(pricePerShare).abs().lt(0.0001)) {
        pricePerShare = newPrice;
        break;
      }
      
      pricePerShare = newPrice;
    }
  }
  
  // Create preferred share class
  let preferredClassId = data.shareClassId;
  if (!preferredClassId || data.createNewShareClass) {
    preferredClassId = uuidv4();
    const existingPreferred = state.shareClasses.filter(sc => sc.type === SHARE_CLASS_TYPES.PREFERRED);
    state.shareClasses.push({
      id: preferredClassId,
      name: data.shareClassName || `Series ${String.fromCharCode(65 + existingPreferred.length)}`,
      type: SHARE_CLASS_TYPES.PREFERRED as ShareClassType,
      seniorityRank: existingPreferred.length + 1,
      liquidationPreferenceMultiple: data.liquidationPreference || 1.0,
      participation: data.participation || 'non_participating',
      participationCapMultiple: data.participationCap,
      isConvertibleToCommon: true,
      pricePerShare: pricePerShare.toString()
    });
  }

  // Convert SAFEs
  for (const safeId of safesToConvert) {
    const safe = state.safes.find((s: SAFE) => s.id === safeId);
    if (!safe || safe.convertedInEventId) continue;

    const conversionResult = calculateSAFEConversion(safe, pricePerShare, preRoundMetrics);
    
    if (!state.people.find(p => p.id === safe.investorId)) {
      state.people.push({
        id: safe.investorId,
        name: safe.investorName || 'SAFE Investor',
        type: PERSON_TYPES.INVESTOR as PersonType
      });
    }

    state.holdings.push({
      id: uuidv4(),
      holderId: safe.investorId,
      shareClassId: preferredClassId,
      quantity: String(conversionResult.shares),
      sourceEventId: event.id,
      isOption: false,
      investmentAmount: safe.principalAmount
    });

    safe.convertedInEventId = event.id;
  }

  // Issue new shares to cash investors
  const investors = (data.investors || []).filter((inv: any) => inv.amount && parseFloat(inv.amount) > 0);
  const totalCashInvestmentActual = investors.reduce(
    (sum: Decimal, inv: any) => sum.plus(toDecimal(inv.amount || 0)), 
    new Decimal(0)
  );
  const totalNewShares = totalCashInvestmentActual.isZero() ? new Decimal(0) : totalCashInvestmentActual.div(pricePerShare);
  
  if (investors.length > 0 && !totalCashInvestmentActual.isZero()) {
    const investorAllocations = investors.map((inv: any) => ({
      id: inv.personId,
      proportion: toDecimal(inv.amount || 0).div(totalCashInvestmentActual)
    }));
    
    const distribution = distributeSharesByLargestRemainder(
      roundShares(totalNewShares),
      investorAllocations
    );

    for (const investor of investors) {
      if (!state.people.find(p => p.id === investor.personId)) {
        state.people.push({
          id: investor.personId,
          name: investor.name,
          type: PERSON_TYPES.INVESTOR as PersonType
        });
      }

      const allocation = distribution.find(d => d.id === investor.personId);
      state.holdings.push({
        id: uuidv4(),
        holderId: investor.personId,
        shareClassId: preferredClassId,
        quantity: String(allocation?.shares || 0),
        sourceEventId: event.id,
        isOption: false,
        investmentAmount: investor.amount
      });
    }
  }

  // Handle ESOP pool target
  if (data.esopTargetPercent) {
    const postRoundMetrics = calculatePreRoundMetrics(state);
    const optionClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.OPTION);
    
    if (optionClass) {
      const currentPool = getUnallocatedESOPPool(state);
      const extension = calculateESOPExtension(
        postRoundMetrics.fullyDilutedShares,
        currentPool,
        data.esopTargetPercent / 100
      );

      if (extension > 0) {
        const poolHolding = state.holdings.find(
          h => h.holderId === ESOP_POOL_HOLDER_ID && h.isOption
        );
        if (poolHolding) {
          poolHolding.quantity = String(parseInt(poolHolding.quantity, 10) + extension);
        }
      }
    }
  }

  return state;
}

function applySAFEIssuance(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  for (const safe of (data.safes || [data])) {
    if (!state.people.find(p => p.id === safe.investorId)) {
      state.people.push({
        id: safe.investorId,
        name: safe.investorName,
        type: PERSON_TYPES.INVESTOR as PersonType
      });
    }

    state.safes.push({
      id: safe.id || uuidv4(),
      investorId: safe.investorId,
      investorName: safe.investorName,
      principalAmount: safe.principalAmount,
      valuationType: safe.valuationType || 'post_money',
      valuationCap: safe.valuationCap,
      discountPercent: safe.discountPercent,
      mostFavoredNation: safe.mostFavoredNation || false,
      issueDate: event.date,
      conversionShareClassId: safe.conversionShareClassId,
      notes: safe.notes
    });
  }

  return state;
}

function applyESOPPoolCreation(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  if (!state.people.find(p => p.id === ESOP_POOL_HOLDER_ID)) {
    state.people.push({
      id: ESOP_POOL_HOLDER_ID,
      name: 'ESOP Pool (Unallocated)',
      type: PERSON_TYPES.ESOP_POOL as PersonType
    });
  }

  let optionClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.OPTION);
  if (!optionClass) {
    const optionClassId = uuidv4();
    state.shareClasses.push({
      id: optionClassId,
      name: 'Employee Options',
      type: SHARE_CLASS_TYPES.OPTION as ShareClassType,
      seniorityRank: 0,
      liquidationPreferenceMultiple: 0,
      participation: 'non_participating',
      isConvertibleToCommon: true
    });
    optionClass = state.shareClasses[state.shareClasses.length - 1];
  }

  let poolShares: number;
  if (data.inputMode === 'percentage') {
    const metrics = calculatePreRoundMetrics(state);
    const existingShares = toDecimal(metrics.legalIssuedShares);
    poolShares = calculateESOPPoolFromPercent(existingShares, data.percentage / 100);
  } else {
    poolShares = parseInt(data.shares, 10);
  }

  const existingPool = state.holdings.find(
    h => h.holderId === ESOP_POOL_HOLDER_ID && h.shareClassId === optionClass!.id
  );

  if (existingPool) {
    existingPool.quantity = String(parseInt(existingPool.quantity, 10) + poolShares);
  } else {
    state.holdings.push({
      id: uuidv4(),
      holderId: ESOP_POOL_HOLDER_ID,
      shareClassId: optionClass.id,
      quantity: String(poolShares),
      sourceEventId: event.id,
      isOption: true
    });
  }

  return state;
}

function applyESOPPoolExtension(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  const metrics = calculatePreRoundMetrics(state);
  const currentPool = getUnallocatedESOPPool(state);
  const extension = calculateESOPExtension(
    metrics.fullyDilutedShares,
    currentPool,
    data.targetPercent / 100
  );

  if (extension > 0) {
    const optionClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.OPTION);
    const poolHolding = state.holdings.find(
      h => h.holderId === ESOP_POOL_HOLDER_ID && h.shareClassId === optionClass?.id
    );

    if (poolHolding) {
      poolHolding.quantity = String(parseInt(poolHolding.quantity, 10) + extension);
    }
  }

  return state;
}

function applyESOPGrant(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  if (!state.people.find(p => p.id === data.employeeId)) {
    state.people.push({
      id: data.employeeId,
      name: data.employeeName,
      type: PERSON_TYPES.EMPLOYEE as PersonType
    });
  }

  const optionClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.OPTION);
  if (!optionClass) {
    throw new Error('No option share class exists. Create an ESOP pool first.');
  }

  let grantShares: number;
  if (data.grantMode === 'percentage' && data.percentage) {
    const metrics = calculatePreRoundMetrics(state);
    const targetPercent = parseFloat(data.percentage) / 100;
    const totalFD = parseFloat(metrics.fullyDilutedShares);
    grantShares = Math.round(targetPercent * totalFD / (1 - targetPercent));
  } else {
    grantShares = parseInt(data.shares, 10) || 0;
  }

  const poolHolding = state.holdings.find(
    h => h.holderId === ESOP_POOL_HOLDER_ID && h.shareClassId === optionClass.id
  );

  if (poolHolding) {
    const currentPool = parseInt(poolHolding.quantity, 10);
    if (currentPool < grantShares) {
      throw new Error(`Insufficient ESOP pool. Available: ${currentPool}, Requested: ${grantShares}`);
    }
    poolHolding.quantity = String(currentPool - grantShares);
  }

  let vestingScheduleId = data.vestingScheduleId;
  if (data.vestingSchedule && !vestingScheduleId) {
    vestingScheduleId = uuidv4();
    state.vestingSchedules.push({
      id: vestingScheduleId,
      ...data.vestingSchedule
    });
  }

  state.holdings.push({
    id: uuidv4(),
    holderId: data.employeeId,
    shareClassId: optionClass.id,
    quantity: String(grantShares),
    sourceEventId: event.id,
    isOption: true,
    strikePrice: data.strikePrice,
    vestingScheduleId: vestingScheduleId,
    vestingStartDate: data.vestingStartDate || event.date,
    grantDate: event.date
  });

  return state;
}

function applyOptionExercise(state: CapTableState, event: EventBase): CapTableState {
  const data = event.data as any;
  
  const optionClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.OPTION);
  const commonClass = state.shareClasses.find(sc => sc.type === SHARE_CLASS_TYPES.COMMON);
  
  if (!optionClass || !commonClass) {
    throw new Error('Option or common share class not found');
  }

  const optionHolding = state.holdings.find(
    h => h.holderId === data.employeeId && h.shareClassId === optionClass.id && h.isOption
  );

  if (!optionHolding) {
    throw new Error('Employee has no option holdings');
  }

  const exerciseShares = parseInt(data.shares, 10);
  const currentOptions = parseInt(optionHolding.quantity, 10);

  const vestedOptions = calculateVestedOptions(optionHolding, event.date, state);
  if (vestedOptions < exerciseShares) {
    throw new Error(`Insufficient vested options. Vested: ${vestedOptions}, Requested: ${exerciseShares}`);
  }

  optionHolding.quantity = String(currentOptions - exerciseShares);

  const existingCommon = state.holdings.find(
    h => h.holderId === data.employeeId && h.shareClassId === commonClass.id && !h.isOption
  );

  if (existingCommon) {
    existingCommon.quantity = String(parseInt(existingCommon.quantity, 10) + exerciseShares);
  } else {
    state.holdings.push({
      id: uuidv4(),
      holderId: data.employeeId,
      shareClassId: commonClass.id,
      quantity: String(exerciseShares),
      sourceEventId: event.id,
      isOption: false
    });
  }

  return state;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function calculatePreRoundMetrics(state: CapTableState): {
  legalIssuedShares: string;
  fullyDilutedShares: string;
  holdingsByClass: Record<string, Decimal>;
  holdingsByHolder: Record<string, Decimal>;
} {
  let legalIssuedShares = new Decimal(0);
  let fullyDilutedShares = new Decimal(0);
  const holdingsByClass: Record<string, Decimal> = {};
  const holdingsByHolder: Record<string, Decimal> = {};

  for (const holding of state.holdings) {
    const qty = toDecimal(holding.quantity);
    
    if (!holdingsByClass[holding.shareClassId]) {
      holdingsByClass[holding.shareClassId] = new Decimal(0);
    }
    holdingsByClass[holding.shareClassId] = holdingsByClass[holding.shareClassId].plus(qty);

    if (!holdingsByHolder[holding.holderId]) {
      holdingsByHolder[holding.holderId] = new Decimal(0);
    }
    holdingsByHolder[holding.holderId] = holdingsByHolder[holding.holderId].plus(qty);

    const shareClass = state.shareClasses.find(sc => sc.id === holding.shareClassId);
    if (shareClass && shareClass.type !== SHARE_CLASS_TYPES.OPTION) {
      legalIssuedShares = legalIssuedShares.plus(qty);
    }

    fullyDilutedShares = fullyDilutedShares.plus(qty);
  }

  return {
    legalIssuedShares: legalIssuedShares.toString(),
    fullyDilutedShares: fullyDilutedShares.toString(),
    holdingsByClass,
    holdingsByHolder
  };
}

export function getUnallocatedESOPPool(state: CapTableState): number {
  const poolHolding = state.holdings.find(
    h => h.holderId === ESOP_POOL_HOLDER_ID && h.isOption
  );
  return poolHolding ? parseInt(poolHolding.quantity, 10) : 0;
}

function calculateSAFEConversion(
  safe: SAFE,
  roundPrice: Decimal,
  preRoundMetrics: { fullyDilutedShares: string }
): { shares: number; effectivePrice: Decimal; method: string } {
  const principal = toDecimal(safe.principalAmount);
  let effectivePrice = roundPrice;
  let method = 'round_price';

  let capPrice: Decimal | null = null;
  if (safe.valuationCap) {
    const cap = toDecimal(safe.valuationCap);
    capPrice = cap.div(toDecimal(preRoundMetrics.fullyDilutedShares));
  }

  let discountPrice: Decimal | null = null;
  if (safe.discountPercent && safe.discountPercent > 0) {
    discountPrice = roundPrice.times(1 - safe.discountPercent / 100);
  }

  if (capPrice && discountPrice) {
    if (capPrice.lt(discountPrice)) {
      effectivePrice = capPrice;
      method = 'cap';
    } else {
      effectivePrice = discountPrice;
      method = 'discount';
    }
  } else if (capPrice) {
    if (capPrice.lt(roundPrice)) {
      effectivePrice = capPrice;
      method = 'cap';
    }
  } else if (discountPrice) {
    if (discountPrice.lt(roundPrice)) {
      effectivePrice = discountPrice;
      method = 'discount';
    }
  }

  const shares = roundShares(principal.div(effectivePrice));

  return { shares, effectivePrice, method };
}

export function calculateVestedOptions(
  holding: SecurityHolding,
  asOfDate: string,
  state: CapTableState
): number {
  if (!holding.vestingScheduleId) {
    return parseInt(holding.quantity, 10);
  }

  const schedule = state.vestingSchedules.find(v => v.id === holding.vestingScheduleId);
  if (!schedule) {
    return parseInt(holding.quantity, 10);
  }

  const startDate = new Date(holding.vestingStartDate || holding.grantDate || asOfDate);
  const evalDate = new Date(asOfDate);
  const totalOptions = parseInt(holding.quantity, 10);

  const monthsElapsed = Math.floor(
    (evalDate.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
  );

  if (monthsElapsed < schedule.cliffMonths) {
    return 0;
  }

  const cliffPercent = schedule.initialCliffPercent || 25;
  const cliffVested = Math.floor(totalOptions * cliffPercent / 100);
  
  const remainingOptions = totalOptions - cliffVested;
  const remainingMonths = schedule.totalMonths - schedule.cliffMonths;
  const monthsAfterCliff = monthsElapsed - schedule.cliffMonths;
  
  const postCliffVested = Math.min(
    remainingOptions,
    Math.floor(remainingOptions * monthsAfterCliff / remainingMonths)
  );

  return Math.min(totalOptions, cliffVested + postCliffVested);
}

// =============================================================================
// CAP TABLE VIEWS
// =============================================================================

export function buildLegalCapTable(state: CapTableState): LegalCapTable {
  const rows: LegalCapTableRow[] = [];
  const metrics = calculatePreRoundMetrics(state);
  const totalLegal = toDecimal(metrics.legalIssuedShares);

  for (const person of state.people) {
    if (person.id === ESOP_POOL_HOLDER_ID) continue;

    const personHoldings = state.holdings.filter(
      h => h.holderId === person.id && !h.isOption
    );

    let totalShares = new Decimal(0);
    const byClass: Record<string, number> = {};

    for (const holding of personHoldings) {
      const qty = toDecimal(holding.quantity);
      totalShares = totalShares.plus(qty);
      
      const shareClass = state.shareClasses.find(sc => sc.id === holding.shareClassId);
      if (shareClass) {
        if (!byClass[shareClass.name]) {
          byClass[shareClass.name] = 0;
        }
        byClass[shareClass.name] += roundShares(qty);
      }
    }

    if (totalShares.gt(0)) {
      rows.push({
        holderId: person.id,
        holderName: person.name,
        holderType: person.type,
        totalShares: roundShares(totalShares),
        ownershipPercent: totalShares.div(totalLegal).times(100).toFixed(2),
        byClass
      });
    }
  }

  rows.sort((a, b) => b.totalShares - a.totalShares);

  return {
    rows,
    totalShares: roundShares(totalLegal),
    shareClasses: state.shareClasses.filter(sc => sc.type !== SHARE_CLASS_TYPES.OPTION)
  };
}

export function buildFullyDilutedCapTable(state: CapTableState, asOfDate?: string): FullyDilutedCapTable {
  const rows: FullyDilutedCapTableRow[] = [];
  const metrics = calculatePreRoundMetrics(state);
  const totalFD = toDecimal(metrics.fullyDilutedShares);

  for (const person of state.people) {
    const personHoldings = state.holdings.filter(h => h.holderId === person.id);

    let totalShares = new Decimal(0);
    let issuedShares = new Decimal(0);
    let optionShares = new Decimal(0);
    let vestedOptions = 0;
    let unvestedOptions = 0;

    for (const holding of personHoldings) {
      const qty = toDecimal(holding.quantity);
      totalShares = totalShares.plus(qty);

      if (holding.isOption) {
        optionShares = optionShares.plus(qty);
        if (asOfDate && holding.vestingScheduleId) {
          const vested = calculateVestedOptions(holding, asOfDate, state);
          vestedOptions += vested;
          unvestedOptions += (parseInt(holding.quantity, 10) - vested);
        } else {
          vestedOptions += parseInt(holding.quantity, 10);
        }
      } else {
        issuedShares = issuedShares.plus(qty);
      }
    }

    if (totalShares.gt(0)) {
      rows.push({
        holderId: person.id,
        holderName: person.name,
        holderType: person.type,
        isESOPPool: person.id === ESOP_POOL_HOLDER_ID,
        totalShares: roundShares(totalShares),
        issuedShares: roundShares(issuedShares),
        optionShares: roundShares(optionShares),
        vestedOptions,
        unvestedOptions,
        ownershipPercent: totalShares.div(totalFD).times(100).toFixed(2)
      });
    }
  }

  const unconvertedSAFEs = state.safes.filter(s => !s.convertedInEventId);

  rows.sort((a, b) => b.totalShares - a.totalShares);

  return {
    rows,
    totalShares: roundShares(totalFD),
    shareClasses: state.shareClasses,
    unconvertedSAFEs
  };
}

export function calculateExitWaterfall(state: CapTableState, exitValuation: number): ExitWaterfall {
  const exitValue = toDecimal(exitValuation);
  const results: ExitDistribution[] = [];
  
  // Clone state for exit calculations
  const exitState: CapTableState = {
    ...state,
    holdings: [...state.holdings.map(h => ({ ...h }))],
    people: [...state.people],
    shareClasses: [...state.shareClasses],
    safes: [...state.safes]
  };
  
  // Convert unconverted SAFEs
  const unconvertedSAFEs = exitState.safes.filter(s => !s.convertedInEventId);
  
  if (unconvertedSAFEs.length > 0) {
    let preExitFD = new Decimal(0);
    for (const holding of exitState.holdings) {
      preExitFD = preExitFD.plus(toDecimal(holding.quantity));
    }
    
    let safeConversionClassId: string;
    const existingPreferred = exitState.shareClasses.filter(sc => sc.type === SHARE_CLASS_TYPES.PREFERRED);
    
    if (existingPreferred.length > 0) {
      safeConversionClassId = existingPreferred.sort((a, b) => b.seniorityRank - a.seniorityRank)[0].id;
    } else {
      safeConversionClassId = uuidv4();
      exitState.shareClasses.push({
        id: safeConversionClassId,
        name: 'SAFE Conversion',
        type: SHARE_CLASS_TYPES.PREFERRED as ShareClassType,
        seniorityRank: 1,
        liquidationPreferenceMultiple: 1.0,
        participation: 'non_participating',
        isConvertibleToCommon: true,
        pricePerShare: exitValue.div(preExitFD).toString()
      });
    }
    
    const exitPricePerShare = exitValue.div(preExitFD);
    
    for (const safe of unconvertedSAFEs) {
      const principal = toDecimal(safe.principalAmount);
      let effectivePrice = exitPricePerShare;
      
      if (safe.valuationCap) {
        const capPrice = toDecimal(safe.valuationCap).div(preExitFD);
        if (capPrice.lt(effectivePrice)) {
          effectivePrice = capPrice;
        }
      }
      
      if (safe.discountPercent && safe.discountPercent > 0) {
        const discountPrice = exitPricePerShare.times(1 - safe.discountPercent / 100);
        if (discountPrice.lt(effectivePrice)) {
          effectivePrice = discountPrice;
        }
      }
      
      const shares = roundShares(principal.div(effectivePrice));
      
      if (!exitState.people.find(p => p.id === safe.investorId)) {
        exitState.people.push({
          id: safe.investorId,
          name: safe.investorName || 'SAFE Investor',
          type: PERSON_TYPES.INVESTOR as PersonType
        });
      }
      
      exitState.holdings.push({
        id: uuidv4(),
        holderId: safe.investorId,
        shareClassId: safeConversionClassId,
        quantity: String(shares),
        sourceEventId: '',
        isOption: false,
        investmentAmount: safe.principalAmount
      });
    }
  }
  
  const preferredClasses = exitState.shareClasses
    .filter(sc => sc.type === SHARE_CLASS_TYPES.PREFERRED)
    .sort((a, b) => b.seniorityRank - a.seniorityRank);
  
  const classTotals: Record<string, Decimal> = {};
  const holderInvestments: Record<string, Decimal> = {};
  
  for (const holding of exitState.holdings) {
    if (!classTotals[holding.shareClassId]) {
      classTotals[holding.shareClassId] = new Decimal(0);
    }
    classTotals[holding.shareClassId] = classTotals[holding.shareClassId].plus(toDecimal(holding.quantity));
    
    if (holding.investmentAmount) {
      if (!holderInvestments[holding.holderId]) {
        holderInvestments[holding.holderId] = new Decimal(0);
      }
      holderInvestments[holding.holderId] = holderInvestments[holding.holderId].plus(toDecimal(holding.investmentAmount));
    }
  }

  let totalCommonEquivalent = new Decimal(0);
  for (const shareClass of exitState.shareClasses) {
    if (shareClass.type !== SHARE_CLASS_TYPES.OPTION) {
      totalCommonEquivalent = totalCommonEquivalent.plus(classTotals[shareClass.id] || new Decimal(0));
    }
  }

  const distributions = new Map<string, { proceeds: Decimal; method: string[] }>();

  // Pay liquidation preferences
  for (const prefClass of preferredClasses) {
    const classShares = classTotals[prefClass.id] || new Decimal(0);
    if (classShares.isZero()) continue;

    const pricePerShare = toDecimal(prefClass.pricePerShare || 0);
    
    const holdersOfClass = exitState.holdings.filter(h => h.shareClassId === prefClass.id);
    
    for (const holding of holdersOfClass) {
      const holderShares = toDecimal(holding.quantity);
      const holderPreference = holderShares.times(pricePerShare).times(prefClass.liquidationPreferenceMultiple || 1);
      const holderConversion = exitValue.times(holderShares).div(totalCommonEquivalent);
      
      let holderProceeds: Decimal;
      let method: string;
      
      if (prefClass.participation === 'participating') {
        holderProceeds = holderPreference;
        method = 'participating';
      } else if (holderPreference.gt(holderConversion)) {
        holderProceeds = holderPreference;
        method = 'preference';
      } else {
        holderProceeds = holderConversion;
        method = 'conversion';
      }

      if (!distributions.has(holding.holderId)) {
        distributions.set(holding.holderId, { proceeds: new Decimal(0), method: [] });
      }
      const current = distributions.get(holding.holderId)!;
      current.proceeds = current.proceeds.plus(holderProceeds);
      current.method.push(method);
    }
  }

  // Distribute to common holders
  const commonHoldings = exitState.holdings.filter(h => {
    const sc = exitState.shareClasses.find(s => s.id === h.shareClassId);
    return sc && sc.type === SHARE_CLASS_TYPES.COMMON && !h.isOption;
  });

  const totalCommon = commonHoldings.reduce((sum, h) => sum.plus(toDecimal(h.quantity)), new Decimal(0));
  
  let preferenceTotal = new Decimal(0);
  distributions.forEach((dist) => {
    preferenceTotal = preferenceTotal.plus(dist.proceeds);
  });
  const remainingProceeds = Decimal.max(exitValue.minus(preferenceTotal), new Decimal(0));

  for (const holding of commonHoldings) {
    const holderShares = toDecimal(holding.quantity);
    const holderProceeds = totalCommon.isZero() ? new Decimal(0) : remainingProceeds.times(holderShares).div(totalCommon);

    if (!distributions.has(holding.holderId)) {
      distributions.set(holding.holderId, { proceeds: new Decimal(0), method: [] });
    }
    const current = distributions.get(holding.holderId)!;
    current.proceeds = current.proceeds.plus(holderProceeds);
    current.method.push('common');
  }

  // Build results
  for (const person of exitState.people) {
    if (person.id === ESOP_POOL_HOLDER_ID) continue;
    
    const dist = distributions.get(person.id);
    if (!dist) continue;

    const investment = holderInvestments[person.id] || new Decimal(0);
    
    results.push({
      holderId: person.id,
      holderName: person.name,
      holderType: person.type,
      proceeds: dist.proceeds.toFixed(2),
      percentOfExit: dist.proceeds.div(exitValue).times(100).toFixed(2),
      investmentAmount: investment.toString(),
      multiple: investment.isZero() ? 'N/A' : dist.proceeds.div(investment).toFixed(2) + 'x',
      method: [...new Set(dist.method)].join(', ')
    });
  }

  results.sort((a, b) => parseFloat(b.proceeds) - parseFloat(a.proceeds));

  return {
    exitValuation: exitValue.toString(),
    distributions: results,
    totalDistributed: results.reduce((sum, r) => sum + parseFloat(r.proceeds), 0).toFixed(2)
  };
}

// =============================================================================
// OWNERSHIP HISTORY
// =============================================================================

export function computeOwnershipHistory(companyId: string, events: EventBase[]): OwnershipSnapshot[] {
  const { snapshots } = replayAllEvents(companyId, events);
  
  return snapshots.map(snapshot => {
    const metrics = calculatePreRoundMetrics(snapshot.state);
    const totalFD = toDecimal(metrics.fullyDilutedShares);
    
    const ownership = snapshot.state.people
      .filter(p => p.id !== ESOP_POOL_HOLDER_ID)
      .map(person => {
        const personHoldings = snapshot.state.holdings.filter(h => h.holderId === person.id);
        const totalShares = personHoldings.reduce(
          (sum, h) => sum.plus(toDecimal(h.quantity)), 
          new Decimal(0)
        );
        
        return {
          holderId: person.id,
          holderName: person.name,
          holderType: person.type,
          ownershipPercent: totalFD.isZero() ? 0 : totalShares.div(totalFD).times(100).toNumber()
        };
      })
      .filter(o => o.ownershipPercent > 0);
    
    return {
      eventId: snapshot.eventId,
      date: snapshot.date,
      label: snapshot.label,
      ownership
    };
  });
}

// =============================================================================
// FULL CAP TABLE COMPUTATION
// =============================================================================

export interface CapTableResponse {
  legalCapTable: LegalCapTable;
  fullyDilutedCapTable: FullyDilutedCapTable;
  state: CapTableState | null;
}

export function computeCapTable(companyId: string, events: EventBase[]): CapTableResponse {
  if (events.length === 0) {
    return {
      legalCapTable: { rows: [], totalShares: 0, shareClasses: [] },
      fullyDilutedCapTable: { rows: [], totalShares: 0, shareClasses: [], unconvertedSAFEs: [] },
      state: null
    };
  }
  
  const { finalState } = replayAllEvents(companyId, events);
  
  return {
    legalCapTable: buildLegalCapTable(finalState),
    fullyDilutedCapTable: buildFullyDilutedCapTable(finalState),
    state: finalState
  };
}

