// =============================================================================
// CORE TYPES
// =============================================================================

export type PersonType = 'founder' | 'employee' | 'advisor' | 'investor' | 'other' | 'esop_pool';
export type ShareClassType = 'common' | 'preferred' | 'option';
export type ParticipationType = 'non_participating' | 'participating' | 'capped_participating';
export type ValuationType = 'pre_money' | 'post_money';
export type VestingFrequency = 'monthly' | 'quarterly' | 'yearly';
export type EventType = 
  | 'incorporation' 
  | 'priced_round' 
  | 'safe_issuance' 
  | 'esop_pool_creation' 
  | 'esop_pool_extension' 
  | 'esop_grant' 
  | 'option_exercise';

export const ESOP_POOL_HOLDER_ID = '__esop_pool__';

// =============================================================================
// DATA MODELS
// =============================================================================

export interface Company {
  id: string;
  name: string;
  baseCurrency: string;
  incorporationDate?: string;
  authorizedShares?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyStats {
  lastRoundName: string;
  lastRoundPrice: string | null;
  fullyDilutedShares: string;
  legalIssuedShares: string;
  esopPoolPercent: string;
  esopPoolShares: number;
  shareholderCount: number;
  eventCount: number;
}

export interface Person {
  id: string;
  companyId?: string;
  name: string;
  type: PersonType;
  email?: string;
}

export interface ShareClass {
  id: string;
  name: string;
  type: ShareClassType;
  seniorityRank: number;
  liquidationPreferenceMultiple: number;
  participation: ParticipationType;
  participationCapMultiple?: number;
  isConvertibleToCommon: boolean;
  pricePerShare?: string;
  notes?: string;
}

export interface SecurityHolding {
  id: string;
  holderId: string;
  shareClassId: string;
  quantity: string;
  sourceEventId: string;
  isOption: boolean;
  strikePrice?: string;
  vestingScheduleId?: string;
  vestingStartDate?: string;
  grantDate?: string;
  investmentAmount?: string;
}

export interface VestingSchedule {
  id: string;
  description?: string;
  cliffMonths: number;
  totalMonths: number;
  vestingFrequency: VestingFrequency;
  initialCliffPercent: number;
}

export interface SAFE {
  id: string;
  investorId: string;
  investorName?: string;
  principalAmount: string;
  valuationType: ValuationType;
  valuationCap?: string;
  discountPercent?: number;
  mostFavoredNation: boolean;
  issueDate: string;
  conversionShareClassId?: string;
  convertedInEventId?: string;
  notes?: string;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface EventBase {
  id: string;
  companyId: string;
  type: EventType;
  date: string;
  label: string;
  description?: string;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface IncorporationEventData {
  totalIssuedShares: number;
  pricePerShare?: string;
  founderInputMode: 'percentage' | 'shares';
  founders: {
    personId: string;
    name: string;
    percentage?: number;
    shares?: number;
  }[];
  esopPool?: {
    inputMode: 'percentage' | 'shares';
    percentage?: number;
    shares?: number;
  };
}

export interface PricedRoundEventData {
  valuationInputType: 'post_money' | 'pre_money' | 'price_per_share';
  postMoneyValuation?: string;
  preMoneyValuation?: string;
  pricePerShare?: string;
  totalNewMoney: string;
  investors: {
    personId: string;
    name: string;
    amount: string;
  }[];
  shareClassId?: string;
  createNewShareClass?: boolean;
  shareClassName?: string;
  liquidationPreference?: number;
  participation?: ParticipationType;
  participationCap?: number;
  esopTargetPercent?: number;
  safesToConvert?: string[];
}

export interface SAFEIssuanceEventData {
  safes: {
    id?: string;
    investorId: string;
    investorName: string;
    principalAmount: string;
    valuationType: ValuationType;
    valuationCap?: string;
    discountPercent?: number;
    mostFavoredNation?: boolean;
    notes?: string;
  }[];
}

export interface ESOPPoolCreationEventData {
  inputMode: 'percentage' | 'shares';
  percentage?: number;
  shares?: number;
}

export interface ESOPPoolExtensionEventData {
  targetPercent: number;
}

export interface ESOPGrantEventData {
  employeeId: string;
  employeeName: string;
  shares: number;
  strikePrice: string;
  vestingStartDate?: string;
  vestingScheduleId?: string;
  vestingSchedule?: {
    description?: string;
    cliffMonths: number;
    totalMonths: number;
    vestingFrequency: VestingFrequency;
    initialCliffPercent: number;
  };
}

export interface OptionExerciseEventData {
  employeeId: string;
  shares: number;
}

// =============================================================================
// CAP TABLE TYPES
// =============================================================================

export interface LegalCapTableRow {
  holderId: string;
  holderName: string;
  holderType: PersonType;
  totalShares: number;
  ownershipPercent: string;
  byClass: Record<string, number>;
}

export interface LegalCapTable {
  rows: LegalCapTableRow[];
  totalShares: number;
  shareClasses: ShareClass[];
}

export interface FullyDilutedCapTableRow {
  holderId: string;
  holderName: string;
  holderType: PersonType;
  isESOPPool: boolean;
  totalShares: number;
  issuedShares: number;
  optionShares: number;
  vestedOptions: number;
  unvestedOptions: number;
  ownershipPercent: string;
}

export interface FullyDilutedCapTable {
  rows: FullyDilutedCapTableRow[];
  totalShares: number;
  shareClasses: ShareClass[];
  unconvertedSAFEs: SAFE[];
}

export interface CapTableState {
  companyId: string;
  asOfEventId: string | null;
  asOfDate: string | null;
  shareClasses: ShareClass[];
  holdings: SecurityHolding[];
  safes: SAFE[];
  people: Person[];
  vestingSchedules: VestingSchedule[];
}

export interface CapTableResponse {
  legalCapTable: LegalCapTable;
  fullyDilutedCapTable: FullyDilutedCapTable;
  state: CapTableState | null;
}

// =============================================================================
// OWNERSHIP EVOLUTION
// =============================================================================

export interface OwnershipSnapshot {
  eventId: string;
  date: string;
  label: string;
  ownership: {
    holderId: string;
    holderName: string;
    holderType: PersonType;
    ownershipPercent: number;
  }[];
}

// =============================================================================
// EXIT WATERFALL
// =============================================================================

export interface ExitDistribution {
  holderId: string;
  holderName: string;
  holderType: PersonType;
  proceeds: string;
  percentOfExit: string;
  investmentAmount: string;
  multiple: string;
  method: string;
}

export interface ExitWaterfall {
  exitValuation: string;
  distributions: ExitDistribution[];
  totalDistributed: string;
}

// =============================================================================
// UI TYPES
// =============================================================================

export type ViewType = 'timeline' | 'captable' | 'exit' | 'settings';

export interface EventFormData {
  type: EventType;
  date: string;
  label: string;
  description?: string;
  data: Record<string, unknown>;
}

// Event type labels for display
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  incorporation: 'Incorporation',
  priced_round: 'Priced Round',
  safe_issuance: 'SAFE Issuance',
  esop_pool_creation: 'ESOP Pool Creation',
  esop_pool_extension: 'ESOP Pool Extension',
  esop_grant: 'Option Grant',
  option_exercise: 'Option Exercise',
};

// Person type labels
export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  founder: 'Founder',
  employee: 'Employee',
  advisor: 'Advisor',
  investor: 'Investor',
  other: 'Other',
  esop_pool: 'ESOP Pool',
};

