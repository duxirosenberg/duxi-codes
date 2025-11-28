import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Trash2, Download, AlertTriangle, Users, Mail, X, LogOut, Loader2 } from 'lucide-react';
import type { Company } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  getCompanyMembers,
  getPendingInvites,
  inviteToCompany,
  cancelInvite,
  leaveCompany,
  removeMember,
  type CompanyMember,
  type PendingInvite,
} from '../lib/storage';

interface CompanySettingsProps {
  company: Company;
  onUpdate: (data: Partial<Company>) => Promise<void>;
  onDelete: () => Promise<void>;
  onExport: () => Promise<unknown>;
  onLeave?: () => void;
}

export function CompanySettings({ company, onUpdate, onDelete, onExport, onLeave }: CompanySettingsProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: company.name,
    baseCurrency: company.baseCurrency,
    incorporationDate: company.incorporationDate || '',
    authorizedShares: company.authorizedShares?.toString() || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Members state
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  const isAuthenticated = !!user;
  const memberCount = members.length;
  const canDelete = memberCount <= 1;

  // Load members and invites
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoadingMembers(false);
      return;
    }

    const loadMembersAndInvites = async () => {
      setIsLoadingMembers(true);
      try {
        const [membersData, invitesData] = await Promise.all([
          getCompanyMembers(company.id),
          getPendingInvites(company.id),
        ]);
        setMembers(membersData);
        setPendingInvites(invitesData);
      } catch (error) {
        console.error('Failed to load members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembersAndInvites();
  }, [company.id, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate({
        name: formData.name,
        baseCurrency: formData.baseCurrency,
        incorporationDate: formData.incorporationDate || undefined,
        authorizedShares: formData.authorizedShares ? parseInt(formData.authorizedShares, 10) : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await onExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${company.name.toLowerCase().replace(/\s+/g, '-')}-captable-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteError(null);
    setIsInviting(true);
    try {
      const invite = await inviteToCompany(company.id, inviteEmail.trim());
      setPendingInvites([...pendingInvites, invite]);
      setInviteEmail('');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite(inviteId);
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId));
    } catch (error) {
      console.error('Failed to cancel invite:', error);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveCompany(company.id);
      onLeave?.();
    } catch (error) {
      console.error('Failed to leave company:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Company Details */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900">
            Company Details
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="card-body space-y-4">
          <div>
            <label className="input-label">Company Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="input-label">Incorporation Date</label>
              <input
                type="date"
                value={formData.incorporationDate}
                onChange={(e) => setFormData({ ...formData, incorporationDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="input-label">Authorized Shares</label>
            <input
              type="number"
              value={formData.authorizedShares}
              onChange={(e) => setFormData({ ...formData, authorizedShares: e.target.value })}
              className="input"
              placeholder="10,000,000"
            />
            <p className="input-help">Total number of shares the company is authorized to issue</p>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={isSaving} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Members & Sharing - Only for authenticated users */}
      {isAuthenticated && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team Members
            </h3>
          </div>
          <div className="card-body space-y-4">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-charcoal-400" />
              </div>
            ) : (
              <>
                {/* Current Members */}
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 bg-charcoal-50 rounded-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-charcoal-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-charcoal-600">
                            {member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-charcoal-900">
                            {member.email}
                          </p>
                          {member.userId === user?.id && (
                            <span className="text-xs text-charcoal-500">(you)</span>
                          )}
                        </div>
                      </div>
                      {/* Remove button - only for other members, and only if more than 1 member */}
                      {member.userId !== user?.id && members.length > 1 && (
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${member.email} from this company?`)) {
                              try {
                                await removeMember(company.id, member.userId);
                                setMembers(members.filter(m => m.id !== member.id));
                              } catch (error) {
                                console.error('Failed to remove member:', error);
                              }
                            }
                          }}
                          className="btn-ghost p-1 text-charcoal-400 hover:text-red-600"
                          title="Remove member"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wide">
                      Pending Invites
                    </p>
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between py-2 px-3 bg-amber-50 border border-amber-200 rounded-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-charcoal-900">
                              {invite.email}
                            </p>
                            <p className="text-xs text-charcoal-500">
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="btn-ghost p-1 text-charcoal-400 hover:text-charcoal-600"
                          title="Cancel invite"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invite Form */}
                <form onSubmit={handleInvite} className="pt-2">
                  <label className="input-label">Invite by Email</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          setInviteError(null);
                        }}
                        placeholder="colleague@company.com"
                        className="input pl-10"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail.trim()}
                      className="btn-primary"
                    >
                      {isInviting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Invite'
                      )}
                    </button>
                  </div>
                  {inviteError && (
                    <p className="text-sm text-red-600 mt-1">{inviteError}</p>
                  )}
                  <p className="input-help">
                    Invited users will get access when they sign up or log in with this email.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-charcoal-900">
            Data Export
          </h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-charcoal-600 mb-4">
            Export all company data including events, shareholders, and cap table history 
            as a JSON file. This can be used for backup or to import into another instance.
          </p>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export Company Data
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200">
        <div className="card-header bg-red-50 border-b-red-200">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h3>
        </div>
        <div className="card-body space-y-4">
          {/* Leave Company - Only show if there are other members */}
          {isAuthenticated && !canDelete && (
            <div className="pb-4 border-b border-charcoal-100">
              <p className="text-sm text-charcoal-600 mb-4">
                Leave this company. You will lose access to all company data, but the company 
                will remain for other members.
              </p>
              
              {!showLeaveConfirm ? (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="btn bg-amber-600 text-white hover:bg-amber-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Company
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-amber-50 rounded-sm border border-amber-200"
                >
                  <p className="text-sm text-amber-700 mb-4">
                    Are you sure you want to leave <strong>{company.name}</strong>? 
                    You will need to be re-invited to regain access.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLeave}
                      className="btn bg-amber-600 text-white hover:bg-amber-700"
                    >
                      Yes, Leave Company
                    </button>
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Delete Company - Only show if sole member (or guest mode) */}
          {(canDelete || !isAuthenticated) && (
            <div>
              <p className="text-sm text-charcoal-600 mb-4">
                Permanently delete this company and all associated data. This action cannot be undone.
              </p>
              
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Company
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 rounded-sm border border-red-200"
                >
                  <p className="text-sm text-red-700 mb-4">
                    Are you sure you want to delete <strong>{company.name}</strong>? 
                    This will permanently remove all events, shareholders, and cap table data.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onDelete}
                      className="btn bg-red-600 text-white hover:bg-red-700"
                    >
                      Yes, Delete Permanently
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Message when cannot delete */}
          {isAuthenticated && !canDelete && (
            <p className="text-xs text-charcoal-500 italic">
              The company can only be deleted when you are the sole member. 
              Leave the company or ask other members to leave first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
