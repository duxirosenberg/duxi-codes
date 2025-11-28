import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Calendar,
  PieChart,
  LogOut,
  Settings,
  Plus,
  ChevronRight,
  Users,
  Percent,
  Hash,
  CloudOff,
  Cloud,
  LogIn,
  User,
  Upload,
  Loader2,
} from 'lucide-react';
import type { Company, CompanyStats, EventBase, CapTableResponse, ViewType, OwnershipSnapshot } from './types';
import { Timeline } from './components/Timeline';
import { CapTableView } from './components/CapTableView';
import { ExitPlanner } from './components/ExitPlanner';
import { CompanySettings } from './components/CompanySettings';
import { EventModal } from './components/EventModal';
import { CompanySelector } from './components/CompanySelector';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { 
  getStorageProvider, 
  hasLocalData, 
  migrateLocalDataToSupabase, 
  clearLocalData,
  type StorageProvider 
} from './lib/storage';
import { 
  computeCapTable, 
  computeOwnershipHistory,
  calculatePreRoundMetrics,
  getUnallocatedESOPPool,
  ESOP_POOL_HOLDER_ID,
} from './lib/capTableEngine';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();

  // Company state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCompanySelector, setShowCompanySelector] = useState(false);

  // Data state
  const [events, setEvents] = useState<EventBase[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventBase | null>(null);

  // UI state
  const [activeView, setActiveView] = useState<ViewType>('timeline');
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Get the appropriate storage provider based on auth state
  const isAuthenticated = !!user;
  const storage: StorageProvider = useMemo(
    () => getStorageProvider(isAuthenticated),
    [isAuthenticated]
  );

  // Compute cap table and ownership from events (client-side)
  const capTable: CapTableResponse | null = useMemo(() => {
    if (!selectedCompany || events.length === 0) return null;
    return computeCapTable(selectedCompany.id, events);
  }, [selectedCompany, events]);

  const ownershipHistory: OwnershipSnapshot[] = useMemo(() => {
    if (!selectedCompany || events.length === 0) return [];
    return computeOwnershipHistory(selectedCompany.id, events);
  }, [selectedCompany, events]);

  // Compute company stats from cap table
  const companyStats: CompanyStats | null = useMemo(() => {
    if (!capTable || !capTable.state) return null;
    
    const state = capTable.state;
    const metrics = calculatePreRoundMetrics(state);
    const esopPool = getUnallocatedESOPPool(state);
    const totalFD = parseFloat(metrics.fullyDilutedShares);
    const esopPercent = totalFD > 0 ? ((esopPool / totalFD) * 100).toFixed(1) : '0';
    
    // Find last priced round
    const pricedRounds = events.filter(e => e.type === 'priced_round');
    const lastRound = pricedRounds[pricedRounds.length - 1];
    
    // Get price from share class
    const preferredClasses = state.shareClasses.filter(sc => sc.type === 'preferred');
    const lastPreferred = preferredClasses[preferredClasses.length - 1];
    
    const shareholderCount = state.people.filter(p => p.id !== ESOP_POOL_HOLDER_ID).length;
    
    return {
      lastRoundName: lastRound?.label || 'Incorporation',
      lastRoundPrice: lastPreferred?.pricePerShare || null,
      fullyDilutedShares: metrics.fullyDilutedShares,
      legalIssuedShares: metrics.legalIssuedShares,
      esopPoolPercent: esopPercent,
      esopPoolShares: esopPool,
      shareholderCount,
      eventCount: events.length,
    };
  }, [capTable, events]);

  // Check for local data when user signs in
  useEffect(() => {
    if (user && hasLocalData()) {
      setShowMigrationModal(true);
    }
  }, [user]);

  // Load companies when auth state changes
  useEffect(() => {
    if (!authLoading) {
      loadCompanies();
    }
  }, [authLoading, isAuthenticated]);

  // Load events when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadEvents();
    }
  }, [selectedCompany, storage]);

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      // If authenticated, first accept any pending invites
      if (isAuthenticated) {
        try {
          const { acceptPendingInvites } = await import('./lib/storage');
          const acceptedCompanies = await acceptPendingInvites();
          if (acceptedCompanies.length > 0) {
            console.log(`Accepted ${acceptedCompanies.length} company invite(s)`);
          }
        } catch (e) {
          console.error('Failed to accept invites:', e);
        }
      }

      const data = await storage.getCompanies();
      setCompanies(data);
      if (data.length > 0 && !selectedCompany) {
        setSelectedCompany(data[0]);
      } else if (data.length === 0) {
        // Don't force company creation - let user see empty state
        setEvents([]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const data = await storage.getEvents(selectedCompany.id);
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }, [selectedCompany, storage]);

  const handleCreateCompany = async (data: Partial<Company>) => {
    try {
      const company = await storage.createCompany(data);
      setCompanies([company, ...companies]);
      setSelectedCompany(company);
      setShowCompanySelector(false);
      setEvents([]);
    } catch (error) {
      console.error('Failed to create company:', error);
    }
  };

  const handleUpdateCompany = async (data: Partial<Company>) => {
    if (!selectedCompany) return;
    try {
      const updated = await storage.updateCompany(selectedCompany.id, data);
      setSelectedCompany(updated);
      setCompanies(companies.map(c => c.id === updated.id ? updated : c));
    } catch (error) {
      console.error('Failed to update company:', error);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    try {
      await storage.deleteCompany(selectedCompany.id);
      const remaining = companies.filter(c => c.id !== selectedCompany.id);
      setCompanies(remaining);
      setSelectedCompany(remaining[0] || null);
      setEvents([]);
      // Don't force company selector - let user see empty state
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  const handleLeaveCompany = () => {
    if (!selectedCompany) return;
    // Remove from local state (already removed from DB in CompanySettings)
    const remaining = companies.filter(c => c.id !== selectedCompany.id);
    setCompanies(remaining);
    setSelectedCompany(remaining[0] || null);
    setEvents([]);
  };

  const handleCreateEvent = async (data: Omit<EventBase, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedCompany) return;
    try {
      await storage.createEvent(selectedCompany.id, data);
      await loadEvents();
      setShowEventModal(false);
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  };

  const handleUpdateEvent = async (eventId: string, data: Partial<EventBase>) => {
    try {
      await storage.updateEvent(eventId, data);
      await loadEvents();
      setEditingEvent(null);
      setShowEventModal(false);
    } catch (error) {
      console.error('Failed to update event:', error);
      throw error;
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await storage.deleteEvent(eventId);
      await loadEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleMigrateData = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateLocalDataToSupabase();
      console.log('Migration complete:', result);
      clearLocalData();
      setShowMigrationModal(false);
      // Reload companies after migration
      await loadCompanies();
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSkipMigration = () => {
    clearLocalData();
    setShowMigrationModal(false);
  };

  const formatNumber = (num: string | number) => {
    return Number(num).toLocaleString();
  };

  const formatCurrency = (amount: string | number | null, currency = 'USD') => {
    if (amount === null) return 'N/A';
    const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || currency + ' '}${Number(amount).toFixed(4)}`;
  };

  // Only show company selector when explicitly requested
  const showCompanySelectorModal = showCompanySelector;
  const isGuest = !user;
  const hasNoCompanies = companies.length === 0 && !isLoading;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Guest Mode Banner */}
      {isGuest && !authLoading && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <CloudOff className="w-4 h-4" />
              <span>Guest mode — data stored locally in your browser</span>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-sm font-medium text-amber-900 hover:text-amber-700 flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in to save
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-charcoal-100 flex flex-col bg-charcoal-50/30">
          {/* Company Header */}
          <div className="p-5 border-b border-charcoal-100">
            <button
              onClick={() => setShowCompanySelector(true)}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-charcoal-900 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-semibold text-charcoal-900 truncate">
                    {selectedCompany?.name || 'Select Company'}
                  </h1>
                  <p className="text-xs text-charcoal-500">
                    {selectedCompany?.baseCurrency || 'USD'} • {selectedCompany?.incorporationDate || 'Not set'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-charcoal-400 group-hover:text-charcoal-600 transition-colors" />
              </div>
            </button>
          </div>

          {/* Quick Stats */}
          {companyStats && (
            <div className="p-4 border-b border-charcoal-100 space-y-3">
              <h2 className="text-xs font-medium text-charcoal-500 uppercase tracking-wider">
                Quick Stats
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="stat-card">
                  <div className="stat-label">Last Round</div>
                  <div className="stat-value text-base">{companyStats.lastRoundName}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Price/Share</div>
                  <div className="stat-value text-base">
                    {formatCurrency(companyStats.lastRoundPrice, selectedCompany?.baseCurrency)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">FD Shares</div>
                  <div className="stat-value text-base">{formatNumber(companyStats.fullyDilutedShares)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">ESOP Pool</div>
                  <div className="stat-value text-base">{companyStats.esopPoolPercent}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            <button
              onClick={() => setActiveView('timeline')}
              className={`nav-item w-full ${activeView === 'timeline' ? 'active' : ''}`}
            >
              <Calendar className="w-4 h-4" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setActiveView('captable')}
              className={`nav-item w-full ${activeView === 'captable' ? 'active' : ''}`}
            >
              <PieChart className="w-4 h-4" />
              <span>Cap Tables</span>
            </button>
            <button
              onClick={() => setActiveView('exit')}
              className={`nav-item w-full ${activeView === 'exit' ? 'active' : ''}`}
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Planner</span>
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`nav-item w-full ${activeView === 'settings' ? 'active' : ''}`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Summary Stats */}
          {companyStats && (
            <div className="p-4 border-t border-charcoal-100">
              <div className="space-y-2 text-xs text-charcoal-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Shareholders
                  </span>
                  <span className="font-mono">{companyStats.shareholderCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5" />
                    Events
                  </span>
                  <span className="font-mono">{companyStats.eventCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Percent className="w-3.5 h-3.5" />
                    ESOP Shares
                  </span>
                  <span className="font-mono">{formatNumber(companyStats.esopPoolShares)}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Account Section */}
          <div className="p-4 border-t border-charcoal-100">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-full flex items-center gap-3 p-2 rounded-sm hover:bg-charcoal-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm text-charcoal-900 truncate">{user.email}</p>
                    <p className="text-xs text-emerald-600">Synced to cloud</p>
                  </div>
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-charcoal-200 rounded-sm shadow-lg overflow-hidden"
                    >
                      <button
                        onClick={async () => {
                          await signOut();
                          setShowUserMenu(false);
                          // Clear state and reload
                          setSelectedCompany(null);
                          setCompanies([]);
                          setEvents([]);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-charcoal-50 transition-colors text-red-600 text-sm"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full flex items-center gap-3 p-2.5 bg-charcoal-900 text-white rounded-sm hover:bg-charcoal-800 transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Sign in to Save</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 border-b border-charcoal-100 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-charcoal-900">
                {activeView === 'timeline' && 'Event Timeline'}
                {activeView === 'captable' && 'Cap Tables'}
                {activeView === 'exit' && 'Exit Scenario Planner'}
                {activeView === 'settings' && 'Company Settings'}
              </h2>
            </div>
            {activeView === 'timeline' && selectedCompany && (
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setShowEventModal(true);
                }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </button>
            )}
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6 bg-charcoal-50/30">
            {/* Empty state when no company exists */}
            {hasNoCompanies ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-charcoal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Building2 className="w-8 h-8 text-charcoal-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-charcoal-900 mb-2">
                    Welcome to Cap Table Timeline
                  </h2>
                  <p className="text-charcoal-600 mb-6">
                    Track your company's ownership evolution with precision. 
                    Create your first company to get started.
                  </p>
                  <button
                    onClick={() => setShowCompanySelector(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Company
                  </button>
                </div>
              </div>
            ) : (
            <AnimatePresence mode="wait">
              {activeView === 'timeline' && (
                <motion.div
                  key="timeline"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Timeline
                    events={events}
                    selectedEvent={selectedEvent}
                    onSelectEvent={setSelectedEvent}
                    onEditEvent={(event) => {
                      setEditingEvent(event);
                      setShowEventModal(true);
                    }}
                    onDeleteEvent={handleDeleteEvent}
                    capTableState={capTable?.state || null}
                  />
                </motion.div>
              )}
              {activeView === 'captable' && (
                <motion.div
                  key="captable"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <CapTableView
                    capTable={capTable}
                    events={events}
                    ownershipHistory={ownershipHistory}
                    companyId={selectedCompany?.id || ''}
                    currency={selectedCompany?.baseCurrency || 'USD'}
                  />
                </motion.div>
              )}
              {activeView === 'exit' && selectedCompany && (
                <motion.div
                  key="exit"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <ExitPlanner
                    companyId={selectedCompany.id}
                    events={events}
                    currency={selectedCompany.baseCurrency}
                  />
                </motion.div>
              )}
              {activeView === 'settings' && selectedCompany && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <CompanySettings
                    company={selectedCompany}
                    onUpdate={handleUpdateCompany}
                    onDelete={handleDeleteCompany}
                    onLeave={handleLeaveCompany}
                    onExport={async () => {
                      // Export company data as JSON
                      const exportData = {
                        company: selectedCompany,
                        events,
                      };
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedCompany.name.toLowerCase().replace(/\s+/g, '-')}-captable.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      return exportData;
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && selectedCompany && (
          <EventModal
            companyId={selectedCompany.id}
            existingEvent={editingEvent}
            existingEvents={events}
            capTable={capTable}
            onSave={editingEvent ? (data) => handleUpdateEvent(editingEvent.id, data) : handleCreateEvent}
            onClose={() => {
              setShowEventModal(false);
              setEditingEvent(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Company Selector Modal */}
      <AnimatePresence>
        {showCompanySelectorModal && (
          <CompanySelector
            companies={companies}
            onSelect={(company) => {
              setSelectedCompany(company);
              setShowCompanySelector(false);
            }}
            onCreate={handleCreateCompany}
            onClose={companies.length > 0 ? () => setShowCompanySelector(false) : undefined}
          />
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}
      </AnimatePresence>

      {/* Migration Modal */}
      <AnimatePresence>
        {showMigrationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content max-w-md"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-charcoal-900 mb-2">
                  Migrate Your Data
                </h3>
                <p className="text-sm text-charcoal-600 mb-6">
                  We found cap table data stored in your browser from guest mode. 
                  Would you like to migrate it to your account?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleSkipMigration}
                    className="btn-secondary flex-1"
                    disabled={isMigrating}
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleMigrateData}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={isMigrating}
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Migrating...
                      </>
                    ) : (
                      'Migrate Data'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
