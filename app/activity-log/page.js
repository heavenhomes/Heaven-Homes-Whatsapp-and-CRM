"use client";
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Activity as ActivityIcon, Search, ChevronLeft, ChevronRight,
  FolderOpen, User, Home, Calendar, Shield, LogIn, LogOut,
  Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Clock,
} from 'lucide-react';

const CATEGORY_TABS = [
  { value: 'all',        label: 'All Activity',  icon: ActivityIcon },
  { value: 'lead',       label: 'Leads',         icon: User },
  { value: 'property',   label: 'Properties',    icon: Home },
  { value: 'site_visit', label: 'Site Visits',   icon: Calendar },
  { value: 'team',       label: 'Team',          icon: Shield },
  { value: 'auth',       label: 'Auth',          icon: LogIn },
];
const RANGE_TABS = [
  { value: 'all',    label: 'All Time' },
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: 'Last 7 Days' },
  { value: '30d',    label: 'Last 30 Days' },
];

const SEVERITY_STYLES = {
  info:    { bg: 'bg-[#e6f0fb]', text: 'text-[#2a6ba8]', dot: 'bg-[#2a6ba8]', label: 'Info' },
  success: { bg: 'bg-[#e8f5e6]', text: 'text-[#2d7a3a]', dot: 'bg-[#2d7a3a]', label: 'Success' },
  warning: { bg: 'bg-[#fef7e0]', text: 'text-[#b68b40]', dot: 'bg-[#b68b40]', label: 'Warning' },
  danger:  { bg: 'bg-[#fde8e8]', text: 'text-[#c0392b]', dot: 'bg-[#c0392b]', label: 'Danger' },
};

function actionIcon(action) {
  if (action === 'auth.login') return LogIn;
  if (action === 'auth.logout') return LogOut;
  if (action.endsWith('.created')) return Plus;
  if (action.endsWith('.assigned')) return User;
  if (action.endsWith('.updated')) return Pencil;
  if (action.endsWith('.deleted')) return Trash2;
  if (action.endsWith('.completed')) return CheckCircle;
  if (action.endsWith('.cancelled')) return AlertTriangle;
  if (action.endsWith('.sold')) return CheckCircle;
  if (action.endsWith('.listed')) return CheckCircle;
  return Clock;
}

function actorLabel(actorType) {
  if (actorType === 'owner') return 'Owner';
  if (actorType === 'channel_partner') return 'Channel Partner';
  return 'System';
}

function relativeTime(dateStr) {
  const date = new Date(dateStr);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLogPage() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    total: 0, today: 0, leadEvents: 0, propertyEvents: 0, teamEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [expandedId, setExpandedId] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/activity/stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('[activity] stats fetch error:', err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        category,
        page: String(page),
        limit: '30',
      });
      if (search) params.set('search', search);
      if (range && range !== 'all') params.set('range', range);
      const res = await fetch(`/api/activity?${params}`);
      const json = await res.json();
      if (json.success) {
        setEvents(Array.isArray(json.data) ? json.data : []);
        setPagination(json.pagination || { total: 0, pages: 1 });
      } else {
        toast.error('Failed to load activity');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [category, page, search, range]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCategoryChange = (value) => {
    setCategory(value);
    setPage(1);
    setExpandedId(null);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
    setExpandedId(null);
  };
  const handleRangeChange = (value) => {
    setRange(value);
    setPage(1);
    setExpandedId(null);
  };

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Header */}
      <div className="mb-6 mt-16 md:mt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a] flex items-center gap-2">
            <span className="w-2 h-7 sm:h-8 bg-[#2d7a3a] rounded-full mr-2 flex-shrink-0" />
            Activity Log
          </h1>
          <p className="text-sm text-[#4f6b4f] mt-1 ml-4">
            Every action across your CRM, in one place
          </p>
        </div>
        <span className="text-xs bg-white px-4 py-2 rounded-full border border-[#e8f0e6] text-[#4f6b4f] shadow-sm flex items-center gap-2 w-fit">
          <ActivityIcon className="w-3.5 h-3.5 text-[#2d7a3a]" />
          {stats.total} Total Events
        </span>
      </div>

      {/* KPI cards */}
      <div
        className="mb-6"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <KpiCard icon={ActivityIcon} label="Today" value={stats.today} tone="blue" />
        <KpiCard icon={User} label="Lead Events" value={stats.leadEvents} tone="green" />
        <KpiCard icon={Home} label="Property Events" value={stats.propertyEvents} tone="amber" />
        <KpiCard icon={Shield} label="Team Events" value={stats.teamEvents} tone="purple" />
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-3 sm:p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
            {CATEGORY_TABS.map(({ value, label, icon: Icon }) => {
              const isActive = category === value;
              return (
                <button
                  key={value}
                  onClick={() => handleCategoryChange(value)}
                  className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#2d7a3a] text-white shadow-sm'
                      : 'text-[#4f6b4f] hover:bg-[#f0f7ef]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}

            <span className="hidden lg:block w-px bg-[#e8f0e6] mx-1 self-stretch" aria-hidden />

            {RANGE_TABS.map(({ value, label }) => {
              const isActive = range === value;
              return (
                <button
                  key={value}
                  onClick={() => handleRangeChange(value)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#092b1f] text-white shadow-sm'
                      : 'text-[#4f6b4f] hover:bg-[#f0f7ef]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a7f6a]" />
            <input
              type="text"
              placeholder="Search description, actor, target..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
            />
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#fafffa]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider w-12"></th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Event</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Actor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Target</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-[#6a7f6a]">Loading activity...</p>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={5} className="text-center py-12 text-[#6a7f6a] text-sm">
                    <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
                    No activity yet
                  </td>
                </tr>
              ) : (
                events.map((e) => {
                  const Icon = actionIcon(e.action);
                  const tone = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info;
                  const isExpanded = expandedId === e._id;
                  const hasChanges = e.changes && Object.keys(e.changes).length > 0;

                  return (
                    <tr
                      key={e._id}
                      onClick={() => setExpandedId(isExpanded ? null : e._id)}
                      className={`border-t border-[#eef5ec] transition-colors ${
                        hasChanges ? 'cursor-pointer hover:bg-[#fafffa]' : ''
                      }`}
                    >
                      <td className="px-5 py-3 align-top">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone.bg}`}>
                          <Icon className={`w-4 h-4 ${tone.text}`} />
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <p className="text-sm text-[#1a2e1a]">{e.description}</p>
                        <p className="text-[10px] text-[#6a7f6a] font-mono mt-0.5 uppercase tracking-wider">
                          {e.action}
                        </p>
                        {isExpanded && hasChanges && (
                          <div className="mt-2 text-xs bg-[#f0f7ef] border border-[#e8f0e6] rounded-lg p-2 space-y-1 max-w-md">
                            <p className="text-[10px] uppercase tracking-wider text-[#6a7f6a] font-medium mb-1">
                              Changes
                            </p>
                            {Object.entries(e.changes).map(([k, v]) => (
                              <div key={k} className="text-[#4f6b4f] break-words">
                                <span className="font-medium text-[#1a2e1a]">{k}:</span>{' '}
                                {typeof v === 'object' && v !== null && v.from !== undefined ? (
                                  <>
                                    <span className="line-through text-[#c0392b]">{v.from || '(empty)'}</span>
                                    {' → '}
                                    <span className="text-[#2d7a3a] font-medium">{v.to || '(empty)'}</span>
                                  </>
                                ) : String(v)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#e8f5e6] flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 text-[#2d7a3a]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#1a2e1a] truncate">
                              {e.actorName || 'System'}
                            </p>
                            <p className="text-[10px] text-[#6a7f6a] uppercase tracking-wider">
                              {actorLabel(e.actorType)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        {e.targetLabel ? (
                          <div className="min-w-0">
                            <p className="text-xs text-[#1a2e1a] truncate max-w-[200px]">
                              {e.targetLabel}
                            </p>
                            {e.targetType && (
                              <p className="text-[10px] text-[#6a7f6a] uppercase tracking-wider">
                                {e.targetType}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#6a7f6a]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top text-right">
                        <p className="text-xs text-[#4f6b4f] whitespace-nowrap" title={fullDateTime(e.createdAt)}>
                          {relativeTime(e.createdAt)}
                        </p>
                        <p className="text-[10px] text-[#6a7f6a] whitespace-nowrap">
                          {fullDateTime(e.createdAt)}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#eef5ec]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#6a7f6a] mt-3">Loading activity...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-[#6a7f6a] text-sm">
              <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
              No activity yet
            </div>
          ) : (
            events.map((e) => {
              const Icon = actionIcon(e.action);
              const tone = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info;
              const isExpanded = expandedId === e._id;
              const hasChanges = e.changes && Object.keys(e.changes).length > 0;

              return (
                <div
                  key={e._id}
                  onClick={() => hasChanges && setExpandedId(isExpanded ? null : e._id)}
                  className={`p-4 space-y-2.5 ${hasChanges ? 'cursor-pointer active:bg-[#fafffa]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.bg}`}>
                      <Icon className={`w-4 h-4 ${tone.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#1a2e1a] break-words">{e.description}</p>
                      <p className="text-[10px] text-[#6a7f6a] font-mono mt-0.5 uppercase tracking-wider truncate">
                        {e.action}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pl-11">
                    <div className="min-w-0">
                      <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Actor</p>
                      <p className="text-[#1a2e1a] mt-0.5 truncate">
                        {e.actorName || 'System'}
                        <span className="text-[#6a7f6a]"> · {actorLabel(e.actorType)}</span>
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">When</p>
                      <p className="text-[#1a2e1a] mt-0.5">{relativeTime(e.createdAt)}</p>
                    </div>
                    {e.targetLabel && (
                      <div className="col-span-2 min-w-0">
                        <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Target</p>
                        <p className="text-[#1a2e1a] mt-0.5 truncate">{e.targetLabel}</p>
                      </div>
                    )}
                  </div>

                  {isExpanded && hasChanges && (
                    <div className="ml-11 text-xs bg-[#f0f7ef] border border-[#e8f0e6] rounded-lg p-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-[#6a7f6a] font-medium mb-1">Changes</p>
                      {Object.entries(e.changes).map(([k, v]) => (
                        <div key={k} className="text-[#4f6b4f] break-words">
                          <span className="font-medium text-[#1a2e1a]">{k}:</span>{' '}
                          {typeof v === 'object' && v !== null && v.from !== undefined ? (
                            <>
                              <span className="line-through text-[#c0392b]">{v.from || '(empty)'}</span>
                              {' → '}
                              <span className="text-[#2d7a3a] font-medium">{v.to || '(empty)'}</span>
                            </>
                          ) : String(v)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="px-3 sm:px-5 py-4 border-t border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between gap-2">
            <span className="text-xs text-[#6a7f6a]">
              Page {page} of {pagination.pages} · {pagination.total} events
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => { setPage((p) => p - 1); setExpandedId(null); }}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => { setPage((p) => p + 1); setExpandedId(null); }}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue:   { bg: 'bg-[#e6f0fb]', fg: 'text-[#2a6ba8]' },
    green:  { bg: 'bg-[#e8f5e6]', fg: 'text-[#2d7a3a]' },
    amber:  { bg: 'bg-[#fef7e0]', fg: 'text-[#b68b40]' },
    purple: { bg: 'bg-[#f3e8ff]', fg: 'text-[#7a3aa8]' },
  };
  const t = tones[tone] || tones.green;

  return (
    <div className="bg-white rounded-2xl border border-[#e8f0e6] p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 ${t.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${t.fg}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-[#6a7f6a] uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[#1a2e1a] leading-tight mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}