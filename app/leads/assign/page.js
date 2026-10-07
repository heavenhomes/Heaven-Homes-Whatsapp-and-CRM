"use client";
import { useAuth } from '@/lib/auth/useAuth';

// at top of component:

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Search, Phone, MapPin, ChevronLeft, ChevronRight,
  FolderOpen, Pencil, Trash2, X, UserCog,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', tone: 'bg-[#e6f0fb] text-[#2a6ba8]', dot: 'bg-[#2a6ba8]' },
   { value: 'follow_up', label: 'Follow Up', tone: 'bg-[#f3e8ff] text-[#7a3aa8]', dot: 'bg-[#7a3aa8]' },
  { value: 'active', label: 'Active', tone: 'bg-[#fef7e0] text-[#b68b40]', dot: 'bg-[#b68b40]' },
  { value: 'contacted', label: 'Contacted', tone: 'bg-[#e0f2fe] text-[#0284c7]', dot: 'bg-[#0284c7]' },
  { value: 'interested', label: 'Interested', tone: 'bg-[#f3e8ff] text-[#7a3aa8]', dot: 'bg-[#7a3aa8]' },
  { value: 'site_visit_scheduled', label: 'Site Visit Scheduled', tone: 'bg-[#fef3c7] text-[#b45309]', dot: 'bg-[#b45309]' },
  { value: 'site_visit_completed', label: 'Site Visit Completed', tone: 'bg-[#dcfce7] text-[#15803d]', dot: 'bg-[#15803d]' },
  { value: 'lost', label: 'Lost', tone: 'bg-[#fde8e8] text-[#c0392b]', dot: 'bg-[#c0392b]' },
  { value: 'converted', label: 'Converted', tone: 'bg-[#e8f5e6] text-[#2d7a3a]', dot: 'bg-[#2d7a3a]' },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

export default function LeadAssignmentPage() {
  const { isOwner } = useAuth();
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [activePartners, setActivePartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');
  const [saving, setSaving] = useState(false);

  // ---------- Fetchers ----------
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (filterStatus) params.set('currentStatus', filterStatus);
      if (filterCity) params.set('city', filterCity);

      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setLeads(Array.isArray(json.data) ? json.data : []);
        setPagination((p) => ({ ...p, ...json.pagination }));
      } else {
        toast.error('Failed to fetch leads');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch leads');
    } finally { setLoading(false); }
  }, [pagination.page, pagination.limit, filterStatus, filterCity]);

  const fetchAllLeadsForModal = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=200');
      const json = await res.json();
      if (json.success) setAllLeads(Array.isArray(json.data) ? json.data : []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchActivePartners = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members?role=channel_partner&active=true&limit=500');
      const json = await res.json();
      if (json.success) setActivePartners(Array.isArray(json.data) ? json.data : []);
    } catch (err) { console.error(err); }
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    fetchAllLeadsForModal();
    fetchActivePartners();
  }, [fetchAllLeadsForModal, fetchActivePartners]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ---------- Modal handlers ----------
  const openAssignModal = () => {
    setEditingLeadId('');
    setSelectedPartner('');
    setAssignOpen(true);
  };

  const openEditLeadModal = (lead) => {
    setEditingLeadId(lead._id);
    setSelectedPartner(lead.assignedTo || '');
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setEditingLeadId('');
    setSelectedPartner('');
  };

  const handleAssignSave = async () => {
    if (!editingLeadId) return toast.error('Please select a lead');
    if (!selectedPartner) return toast.error('Please select a channel partner');

    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${editingLeadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: selectedPartner }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Assigned to ${selectedPartner}`);
        setLeads((prev) =>
          prev.map((l) =>
            l._id === editingLeadId ? { ...l, assignedTo: selectedPartner } : l
          )
        );
        setAllLeads((prev) =>
          prev.map((l) =>
            l._id === editingLeadId ? { ...l, assignedTo: selectedPartner } : l
          )
        );
        closeAssignModal();
      } else {
        toast.error(json.error || 'Failed to save');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const handleDeleteLead = async (lead) => {
    if (!confirm(`Delete lead "${lead.name || 'Unnamed'}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/leads/${lead._id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Lead deleted');
        setLeads((prev) => prev.filter((l) => l._id !== lead._id));
        setAllLeads((prev) => prev.filter((l) => l._id !== lead._id));
      } else {
        toast.error('Failed to delete lead');
      }
    } catch (err) { console.error(err); toast.error('Failed to delete lead'); }
  };

  // ---------- Derived ----------
  const filteredLeads = leads.filter((lead) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(q) ||
      lead.phone?.includes(q) ||
      lead.city?.toLowerCase().includes(q) ||
      lead.area?.toLowerCase().includes(q) ||
      lead.assignedTo?.toLowerCase().includes(q)
    );
  });

  const modalLeadOptions = useMemo(() => {
    return [...allLeads].sort((a, b) => {
      const aAssigned = a.assignedTo ? 1 : 0;
      const bAssigned = b.assignedTo ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allLeads]);

  const currentModalLead = modalLeadOptions.find((l) => l._id === editingLeadId);

  // ---------- Render ----------
  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Header — one button only, top-right */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#1a2e1a] flex items-center gap-2">
              <span className="w-2 h-8 bg-[#2d7a3a] rounded-full mr-2" />
              Lead Assignment
            </h1>
            <p className="text-sm text-[#4f6b4f] mt-1 ml-4">
              Assign leads to your channel partners
            </p>
          </div>
       <button
  onClick={openAssignModal}
  className="inline-flex items-center justify-center gap-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md self-start lg:self-center"
>
  <UserCog className="w-4 h-4" />
  Assign Lead
</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a7f6a]" />
            <input
              type="text"
              placeholder="Search by name, phone, city, or assignee..."
              className="w-full pl-10 pr-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] md:w-56"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by city..."
            className="px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] md:w-44"
            value={filterCity}
            onChange={(e) => { setFilterCity(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
          />
        </div>
      </div>

      {/* Leads table */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm">

        {/* Mobile — stacked cards, everything readable at a glance, no side-scrolling */}
        <div className="md:hidden divide-y divide-[#eef5ec]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#6a7f6a]">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-[#6a7f6a] text-sm">
              <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
              No leads found
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const s = STATUS_MAP[lead.currentStatus] || STATUS_MAP.new;
              return (
                <div key={lead._id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#1a2e1a] truncate">{lead.name || 'N/A'}</p>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full ${s.tone}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>

                  <p className="text-xs text-[#4f6b4f] flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3 text-[#6a7f6a]" /> {lead.phone}
                  </p>

                  {lead.city && (
                    <p className="text-xs text-[#4f6b4f] flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-[#6a7f6a]" />
                      {lead.city}{lead.area ? ` · ${lead.area}` : ''}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    {lead.assignedTo ? (
                      <span className="text-xs text-[#1a2e1a] font-medium">{lead.assignedTo}</span>
                    ) : (
                      <span className="text-xs text-[#6a7f6a] italic">Unassigned</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditLeadModal(lead)}
                        title="Edit assignment"
                        className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#f0f7ef] hover:border-[#2d7a3a] transition-colors group"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteLead(lead)}
                          title="Delete lead"
                          className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] transition-colors group"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#c0392b]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / tablet — full table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#fafffa]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Lead Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Contact Number</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">City / Area</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Assigned Channel Partner</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Current Lead Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-[#6a7f6a]">Loading leads...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={6} className="text-center py-12 text-[#6a7f6a] text-sm">
                    <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const s = STATUS_MAP[lead.currentStatus] || STATUS_MAP.new;
                  return (
                    <tr key={lead._id} className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[#1a2e1a]">{lead.name || 'N/A'}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-[#4f6b4f] flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#6a7f6a]" /> {lead.phone}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-[#4f6b4f] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#6a7f6a]" /> {lead.city || '—'}
                        </p>
                        {lead.area && <p className="text-xs text-[#6a7f6a] ml-4">{lead.area}</p>}
                      </td>
                      <td className="px-5 py-3">
                        {lead.assignedTo ? (
                          <span className="text-sm text-[#1a2e1a] font-medium">{lead.assignedTo}</span>
                        ) : (
                          <span className="text-sm text-[#6a7f6a] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${s.tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>

                      {/* Action — Edit + Delete only */}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditLeadModal(lead)}
                            title="Edit assignment"
                            className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#f0f7ef] hover:border-[#2d7a3a] transition-colors group"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                          </button>
                         { isOwner && (
                            <button
                              onClick={() => handleDeleteLead(lead)}
                              title="Delete lead"
                              className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] transition-colors group"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#c0392b]" />
                          </button>)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="px-5 py-4 border-t border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between">
            <span className="text-xs text-[#6a7f6a]">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============ COMPACT ASSIGN / EDIT MODAL ============ */}
      {assignOpen && (
   <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
    onClick={closeAssignModal}
  >
      <div
      className="bg-white rounded-2xl shadow-xl mx-auto"
      style={{ width: '100%', maxWidth: '440px' }}
      onClick={(e) => e.stopPropagation()}
    >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8f0e6] bg-[#fafffa] rounded-t-2xl">
              <div>
                <h2 className="text-base font-semibold text-[#1a2e1a]">
                  {editingLeadId ? 'Change Channel Partner' : 'Assign Lead'}
                </h2>
                <p className="text-xs text-[#6a7f6a] mt-0.5">
                  {editingLeadId
                    ? 'Update the assigned channel partner'
                    : 'Choose a lead and a channel partner'}
                </p>
              </div>
              <button onClick={closeAssignModal} className="text-[#6a7f6a] hover:text-[#1a2e1a]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Lead — locked when editing, dropdown when assigning new */}
              <div>
                <label className="block text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
                  Lead
                </label>

                {editingLeadId ? (
                  /* Locked display: name + phone, no editing */
                  <div className="bg-[#f0f7ef] border border-[#e8f0e6] rounded-xl px-3 py-2.5">
                    <p className="text-sm font-medium text-[#1a2e1a]">
                      {currentModalLead?.name || 'N/A'}
                    </p>
                    <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {currentModalLead?.phone || '—'}
                    </p>
                  </div>
                ) : (
                  /* Dropdown only when assigning a new lead */
                  <select
                    value={editingLeadId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setEditingLeadId(id);
                      const l = allLeads.find((x) => x._id === id);
                      setSelectedPartner(l?.assignedTo || '');
                    }}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  >
                    <option value="">— Select a lead —</option>
                    {modalLeadOptions.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name || 'Unnamed'} — {l.phone}
                        {l.assignedTo ? ` (currently: ${l.assignedTo})` : ' (unassigned)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Channel partner dropdown */}
              <div>
                <label className="block text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
                  Assign Channel Partner
                </label>
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                >
                  <option value="">— Select a channel partner —</option>
                  {activePartners.length === 0 && (
                    <option value="" disabled>
                      No partners yet — add them in MongoDB
                    </option>
                  )}
                  {activePartners.map((p) => (
                    <option key={p._id} value={p.name}>
                     {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#e8f0e6]">
              <button
                onClick={closeAssignModal}
                className="px-4 py-2 text-sm text-[#4f6b4f] hover:bg-[#f0f7ef] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSave}
                disabled={saving || !editingLeadId || !selectedPartner}
                className="px-4 py-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : editingLeadId ? 'Update Partner' : 'Assign Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}