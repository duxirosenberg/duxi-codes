/**
 * Storage Abstraction Layer
 * 
 * Provides a unified interface for data storage that works with:
 * - LocalStorage for guest users
 * - Supabase for authenticated users
 */

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { Company, EventBase, Person } from '../types';

// =============================================================================
// STORAGE INTERFACE
// =============================================================================

export interface StorageProvider {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | null>;
  createCompany(data: Partial<Company>): Promise<Company>;
  updateCompany(id: string, data: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Events
  getEvents(companyId: string): Promise<EventBase[]>;
  createEvent(companyId: string, data: Omit<EventBase, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<EventBase>;
  updateEvent(eventId: string, data: Partial<EventBase>): Promise<EventBase>;
  deleteEvent(eventId: string): Promise<void>;
  
  // People (for autocomplete etc)
  getPeople(companyId: string): Promise<Person[]>;
}

// =============================================================================
// LOCAL STORAGE PROVIDER (Guest Mode)
// =============================================================================

const LOCAL_STORAGE_KEYS = {
  COMPANIES: 'captable_companies',
  EVENTS: 'captable_events',
};

function getLocalData<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const localStorageProvider: StorageProvider = {
  // Companies
  async getCompanies(): Promise<Company[]> {
    return getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
  },

  async getCompany(id: string): Promise<Company | null> {
    const companies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
    return companies.find(c => c.id === id) || null;
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    const companies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
    const now = new Date().toISOString();
    const company: Company = {
      id: uuidv4(),
      name: data.name || 'New Company',
      baseCurrency: data.baseCurrency || 'USD',
      incorporationDate: data.incorporationDate,
      authorizedShares: data.authorizedShares,
      createdAt: now,
      updatedAt: now,
    };
    companies.push(company);
    setLocalData(LOCAL_STORAGE_KEYS.COMPANIES, companies);
    return company;
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const companies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
    const index = companies.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Company not found');
    
    companies[index] = {
      ...companies[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setLocalData(LOCAL_STORAGE_KEYS.COMPANIES, companies);
    return companies[index];
  },

  async deleteCompany(id: string): Promise<void> {
    let companies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
    companies = companies.filter(c => c.id !== id);
    setLocalData(LOCAL_STORAGE_KEYS.COMPANIES, companies);
    
    // Also delete related events
    let events = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
    events = events.filter(e => e.companyId !== id);
    setLocalData(LOCAL_STORAGE_KEYS.EVENTS, events);
  },

  // Events
  async getEvents(companyId: string): Promise<EventBase[]> {
    const events = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
    return events
      .filter(e => e.companyId === companyId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  async createEvent(companyId: string, data: Omit<EventBase, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<EventBase> {
    const events = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
    const now = new Date().toISOString();
    const event: EventBase = {
      id: uuidv4(),
      companyId,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    events.push(event);
    setLocalData(LOCAL_STORAGE_KEYS.EVENTS, events);
    return event;
  },

  async updateEvent(eventId: string, data: Partial<EventBase>): Promise<EventBase> {
    const events = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
    const index = events.findIndex(e => e.id === eventId);
    if (index === -1) throw new Error('Event not found');
    
    events[index] = {
      ...events[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    setLocalData(LOCAL_STORAGE_KEYS.EVENTS, events);
    return events[index];
  },

  async deleteEvent(eventId: string): Promise<void> {
    let events = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
    events = events.filter(e => e.id !== eventId);
    setLocalData(LOCAL_STORAGE_KEYS.EVENTS, events);
  },

  // People - extracted from events for guest mode
  async getPeople(_companyId: string): Promise<Person[]> {
    // People are derived from events in guest mode
    // Return empty - the cap table engine will track people
    return [];
  },
};

// =============================================================================
// SUPABASE PROVIDER (Authenticated Mode)
// =============================================================================

export const supabaseProvider: StorageProvider = {
  // Companies
  async getCompanies(): Promise<Company[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      baseCurrency: c.base_currency,
      incorporationDate: c.incorporation_date,
      authorizedShares: c.authorized_shares,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  },

  async getCompany(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return {
      id: data.id,
      name: data.name,
      baseCurrency: data.base_currency,
      incorporationDate: data.incorporation_date,
      authorizedShares: data.authorized_shares,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async createCompany(data: Partial<Company>): Promise<Company> {
    // Use edge function to create company + member atomically (bypasses RLS issue)
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error('Not authenticated');

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/create-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        name: data.name || 'New Company',
        base_currency: data.baseCurrency || 'USD',
        jurisdiction: null,
        incorporation_date: data.incorporationDate || null,
        authorized_shares: data.authorizedShares || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create company');
    }

    const company = await response.json();
    
    return {
      id: company.id,
      name: company.name,
      baseCurrency: company.base_currency,
      incorporationDate: company.incorporation_date,
      authorizedShares: company.authorized_shares,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };
  },

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.baseCurrency !== undefined) updates.base_currency = data.baseCurrency;
    if (data.incorporationDate !== undefined) updates.incorporation_date = data.incorporationDate;
    if (data.authorizedShares !== undefined) updates.authorized_shares = data.authorizedShares;
    
    const { data: company, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: company.id,
      name: company.name,
      baseCurrency: company.base_currency,
      incorporationDate: company.incorporation_date,
      authorizedShares: company.authorized_shares,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };
  },

  async deleteCompany(id: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Events
  async getEvents(companyId: string): Promise<EventBase[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(e => ({
      id: e.id,
      companyId: e.company_id,
      type: e.type,
      date: e.date,
      label: e.label,
      description: e.description,
      data: e.data,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));
  },

  async createEvent(companyId: string, data: Omit<EventBase, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<EventBase> {
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        company_id: companyId,
        type: data.type,
        date: data.date,
        label: data.label,
        description: data.description || null,
        data: data.data,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: event.id,
      companyId: event.company_id,
      type: event.type,
      date: event.date,
      label: event.label,
      description: event.description,
      data: event.data,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };
  },

  async updateEvent(eventId: string, data: Partial<EventBase>): Promise<EventBase> {
    const updates: any = {};
    if (data.type !== undefined) updates.type = data.type;
    if (data.date !== undefined) updates.date = data.date;
    if (data.label !== undefined) updates.label = data.label;
    if (data.description !== undefined) updates.description = data.description;
    if (data.data !== undefined) updates.data = data.data;
    
    const { data: event, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: event.id,
      companyId: event.company_id,
      type: event.type,
      date: event.date,
      label: event.label,
      description: event.description,
      data: event.data,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };
  },

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);
    
    if (error) throw error;
  },

  // People - derived from cap table state
  async getPeople(_companyId: string): Promise<Person[]> {
    // People are tracked within the cap table state, not stored separately
    return [];
  },
};

// =============================================================================
// MIGRATION UTILITIES
// =============================================================================

export async function migrateLocalDataToSupabase(): Promise<{ 
  companiesMigrated: number; 
  eventsMigrated: number;
}> {
  const localCompanies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
  const localEvents = getLocalData<EventBase>(LOCAL_STORAGE_KEYS.EVENTS);
  
  let companiesMigrated = 0;
  let eventsMigrated = 0;
  
  // Map old IDs to new IDs
  const companyIdMap = new Map<string, string>();
  
  for (const company of localCompanies) {
    try {
      const newCompany = await supabaseProvider.createCompany(company);
      companyIdMap.set(company.id, newCompany.id);
      companiesMigrated++;
    } catch (error) {
      console.error('Failed to migrate company:', company.name, error);
    }
  }
  
  for (const event of localEvents) {
    const newCompanyId = companyIdMap.get(event.companyId);
    if (!newCompanyId) continue;
    
    try {
      await supabaseProvider.createEvent(newCompanyId, {
        type: event.type,
        date: event.date,
        label: event.label,
        description: event.description,
        data: event.data,
      });
      eventsMigrated++;
    } catch (error) {
      console.error('Failed to migrate event:', event.label, error);
    }
  }
  
  return { companiesMigrated, eventsMigrated };
}

export function clearLocalData(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.COMPANIES);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.EVENTS);
}

export function hasLocalData(): boolean {
  const companies = getLocalData<Company>(LOCAL_STORAGE_KEYS.COMPANIES);
  return companies.length > 0;
}

// =============================================================================
// STORAGE FACTORY
// =============================================================================

export function getStorageProvider(isAuthenticated: boolean): StorageProvider {
  return isAuthenticated ? supabaseProvider : localStorageProvider;
}

// =============================================================================
// SHARING TYPES
// =============================================================================

export interface CompanyMember {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

// =============================================================================
// SHARING FUNCTIONS (Supabase only)
// =============================================================================

export async function getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/get-company-members?company_id=${companyId}`,
    {
      headers: {
        'Authorization': `Bearer ${session.session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get members');
  }

  const data = await response.json();
  
  return (data || []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    email: m.email || 'Unknown',
    createdAt: m.created_at,
  }));
}

export async function getMemberCount(companyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('company_members')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  
  if (error) throw error;
  return count || 0;
}

export async function getPendingInvites(companyId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('company_id', companyId)
    .gt('expires_at', new Date().toISOString());
  
  if (error) throw error;
  
  return (data || []).map(i => ({
    id: i.id,
    email: i.email,
    invitedBy: i.invited_by,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
  }));
}

export async function inviteToCompany(companyId: string, email: string): Promise<PendingInvite> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Check if user is already a member
  const existingMembers = await getCompanyMembers(companyId);
  const existingEmails = existingMembers.map(m => m.email?.toLowerCase());
  if (existingEmails.includes(email.toLowerCase())) {
    throw new Error('User is already a member of this company');
  }
  
  // Check if invite already exists
  const { data: existingInvite } = await supabase
    .from('pending_invites')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email.toLowerCase())
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (existingInvite) {
    throw new Error('An invite is already pending for this email');
  }
  
  const { data: invite, error } = await supabase
    .from('pending_invites')
    .insert({
      company_id: companyId,
      email: email.toLowerCase(),
      invited_by: user.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: invite.id,
    email: invite.email,
    invitedBy: invite.invited_by,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
  };
}

export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId);
  
  if (error) throw error;
}

export async function leaveCompany(companyId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  await removeMember(companyId, user.id);
}

export async function removeMember(companyId: string, userId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/remove-member`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        user_id: userId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove member');
  }
}

export async function acceptPendingInvites(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return [];
  
  // Find pending invites for this email
  const { data: invites, error: fetchError } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('email', user.email.toLowerCase())
    .gt('expires_at', new Date().toISOString());
  
  if (fetchError || !invites?.length) return [];
  
  const acceptedCompanies: string[] = [];
  
  for (const invite of invites) {
    try {
      // Add user as member
      const { error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: invite.company_id,
          user_id: user.id,
        });
      
      if (!memberError) {
        // Delete the invite
        await supabase
          .from('pending_invites')
          .delete()
          .eq('id', invite.id);
        
        acceptedCompanies.push(invite.company_id);
      }
    } catch (e) {
      console.error('Failed to accept invite:', e);
    }
  }
  
  return acceptedCompanies;
}

