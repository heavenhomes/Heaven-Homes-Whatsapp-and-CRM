"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImageGalleryModal from '@/components/Properties/ImageGalleryModal';
import {
  ArrowLeft, Phone, MessageSquare,
  Star, Building2, Image as ImageIcon,
  Bell, Calendar,
} from 'lucide-react';

const TABS = [
  { id: 'enquiry', label: 'Property Enquiry', icon: Building2 },
  { id: 'interested', label: 'Interested Property', icon: Star },
  { id: 'conversation', label: 'WhatsApp Conversation', icon: MessageSquare },
  { id: 'followups', label: 'Follow Ups', icon: Bell },
  { id: 'visits', label: 'Site Visits', icon: Calendar },
];

const CRM_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'active', label: 'Active' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'site_visit_scheduled', label: 'Site Visit Scheduled' },
  { value: 'site_visit_completed', label: 'Site Visit Completed' },
  { value: 'lost', label: 'Lost' },
  { value: 'converted', label: 'Converted' },
];

// Format a JS Date to "3:45 PM" style
const formatTime12h = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format date to "Mon, Sep 28, 2026"
const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format a JS Date to "Sep 28, 2026" (day group label)
const formatDayLabel = (dateInput) => {
  const d = new Date(dateInput);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Group conversation messages by calendar day
const groupByDay = (messages) => {
  const groups = [];
  let current = null;
  for (const m of messages) {
    const d = new Date(m.at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!current || current.key !== key) {
      current = { key, date: d, items: [] };
      groups.push(current);
    }
    current.items.push(m);
  }
  return groups;
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('enquiry');
  const [subData, setSubData] = useState({
    enquiry: [],
    interested: [],
    conversation: [],
    followUps: null,
    visits: [],
  });
  const [subLoading, setSubLoading] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leads/${params.id}`);
        const json = await res.json();
        if (json.success) setLead(json.data);
        else {
          toast.error('Lead not found');
          router.push('/leads');
        }
      } catch {
        toast.error('Failed to fetch lead');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (!lead) return;
    (async () => {
      setSubLoading(true);
      try {
        const endpointMap = {
          enquiry: `/api/leads/${lead._id}/enquiries`,
          interested: `/api/leads/${lead._id}/interests`,
          conversation: `/api/leads/${lead._id}/conversation`,
          followups: `/api/leads/${lead._id}/follow-ups`,
          visits: `/api/leads/${lead._id}/site-visits`,
        };
        const key = activeTab;
        const url = endpointMap[key];

        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
          if (key === 'followups') {
            setSubData((p) => ({ ...p, followUps: json.data }));
          } else {
            setSubData((p) => ({ ...p, [key]: json.data }));
          }
        }
      } catch (e) {
        console.error('[lead-detail] fetch error', e);
      } finally {
        setSubLoading(false);
      }
    })();
  }, [activeTab, lead]);

  const updateLead = async (patch) => {
    try {
      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success) {
        setLead(json.data);
        toast.success('Updated');
      } else toast.error(json.error || 'Failed to update');
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8faf7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#4f6b4f] text-sm font-medium">Loading lead...</p>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {selectedGallery && (
        <ImageGalleryModal
          images={selectedGallery.images}
          title={selectedGallery.title}
          onClose={() => setSelectedGallery(null)}
        />
      )}
      <div className="mb-6">
        <button
          onClick={() => router.push('/leads')}
          className="text-sm text-[#6a7f6a] hover:text-[#1a2e1a] mb-2 inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a] break-words">
            {lead.name || 'Lead'}
          </h1>
          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
            lead.source === 'manual'
              ? 'bg-[#fef7e0] text-[#b68b40]'
              : 'bg-[#e8f5e6] text-[#2d7a3a]'
          }`}>
            {lead.source === 'manual' ? 'Manual' : 'WhatsApp'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-[#4f6b4f]">
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {lead.phone}
          </span>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-4 sm:p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Field label="Name" value={lead.name} />
          <Field label="Contact Number" value={lead.phone} />
          <Field label="Assigned To">
            {lead.assignedTo ? (
              <p className="text-sm font-medium text-[#1a2e1a] break-words">
                {lead.assignedTo}
              </p>
            ) : (
              <p className="text-sm text-[#6a7f6a] italic">Unassigned</p>
            )}
          </Field>
          <Field label="Current Status">
            <select
              value={lead.currentStatus || 'new'}
              onChange={(e) => updateLead({ currentStatus: e.target.value })}
              className="w-full px-2 py-1 border border-[#e8f0e6] rounded-lg text-sm bg-[#fafffa] focus:outline-none focus:border-[#2d7a3a]"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] mb-4 shadow-sm overflow-hidden">
        <div className="flex border-b border-[#e8f0e6] overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === id
                  ? 'text-[#2d7a3a] border-b-2 border-[#2d7a3a]'
                  : 'text-[#6a7f6a] hover:text-[#1a2e1a]'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] shadow-sm p-4 md:p-6">
        {subLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'enquiry' && (
              <EnquiryTab enquiries={subData.enquiry} />
            )}
            {activeTab === 'interested' && (
              <InterestedTab
                interests={subData.interested}
                selectedProperty={lead.interested}
                onOpenGallery={(property) => {
                  const images = Array.isArray(property.images) ? property.images : [];
                  setSelectedGallery({
                    images: property.imageUrl
                      ? [property.imageUrl, ...images]
                      : images,
                    title: property.title || 'Property',
                  });
                }}
              />
            )}
            {activeTab === 'conversation' && (
              <ConversationTab conversation={subData.conversation} />
            )}
            {activeTab === 'followups' && (
              <FollowUpsTab data={subData.followUps} />
            )}
            {activeTab === 'visits' && <VisitsTab visits={subData.visits} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Sub components ---------- */

function Field({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label}
      </p>
      {children || (
        <p className="text-sm font-medium text-[#1a2e1a] break-words">
          {value || '—'}
        </p>
      )}
    </div>
  );
}

function EnquiryTab({ enquiries }) {
  if (!enquiries?.length)
    return <Empty icon={Building2} text="No property enquiries yet" />;

  const sorted = [...enquiries].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  );

  return (
    <div className="space-y-5">
      {sorted.map((e, idx) => (
        <div
          key={e._id}
          className="rounded-2xl border-2 border-[#dbead8] bg-gradient-to-br from-[#fafffa] to-[#f0f7ef] p-4 sm:p-5 shadow-sm relative overflow-hidden"
        >
          {/* Left accent bar to visually distinguish each enquiry */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2d7a3a]" />

          <div className="flex items-center justify-between mb-4 pl-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2d7a3a] text-white text-xs font-semibold">
                {idx + 1}
              </span>
              <span className="text-xs font-semibold text-[#2d7a3a] uppercase tracking-wider">
                Enquiry
              </span>
            </div>
            <p className="text-xs text-[#6a7f6a] font-medium">
              {new Date(e.submittedAt).toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pl-3">
            <Detail label="City" value={e.city} />
            <Detail label="Area" value={e.area} />
            <Detail label="Purpose" value={e.purpose} />
            <Detail label="Property Category" value={e.propertyCategory} />
            <Detail label="Property Type" value={e.propertyType} />
            <Detail
              label="Configuration / Size"
              value={e.configuration || e.size}
            />
            <Detail label="Budget" value={e.budgetLabel || e.budgetRange} />
            <Detail label="Timeline" value={e.timeline} />
            {e.buyingPlan && (
              <Detail
                label="Buying Plan"
                value={
                  e.buyingPlan === 'sell_then_buy'
                    ? 'First sell then buy'
                    : 'Directly buy'
                }
              />
            )}
            {e.furnishing && (
              <Detail
                label="Furnishing"
                value={e.furnishing.replace(/_/g, ' ')}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InterestedTab({ interests, selectedProperty, onOpenGallery }) {
  const list = Array.isArray(interests) ? interests : [];
  const selectedPropertyId =
    typeof selectedProperty === 'object' && selectedProperty !== null
      ? selectedProperty._id
      : selectedProperty;
  const hasSelectedProperty = selectedProperty &&
    !list.some((interest) => {
      const propertyId =
        typeof interest.property === 'object' && interest.property !== null
          ? interest.property._id
          : interest.property;
      return String(propertyId) === String(selectedPropertyId);
    });
  const displayedInterests = hasSelectedProperty
    ? [{ _id: `selected-${selectedPropertyId}`, property: selectedProperty, manuallySelected: true }, ...list]
    : list;
  if (displayedInterests.length === 0) {
    return <Empty icon={Star} text="No interested properties yet" />;
  }

  return (
    <div className="space-y-3">
      {displayedInterests.map((it, idx) => {
        const p =
          typeof it.property === 'object' && it.property !== null
            ? it.property
            : null;
        const publicTitle = p?.title || it.propertyTitle || 'Property';
        const propertyId = p?.propertyId || it.propertySnapshot?.propertyId || '';
        const internalName =
          p?.internalName || it.propertySnapshot?.internalName || '';
        const city = p?.city || it.propertySnapshot?.city || '';
        const area = p?.area || it.propertySnapshot?.area || '';
        const price = p?.price || it.propertySnapshot?.price || 0;
        const image = p?.imageUrl || it.propertySnapshot?.imageUrl || null;
        const images = p?.images || it.propertySnapshot?.images || [];
        const galleryImages = image ? [image, ...images] : images;

        return (
          <div
            key={it._id || `int-${idx}`}
            className="border border-[#eef5ec] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-[#fafffa] transition-colors"
          >
            {image ? (
              <button
                type="button"
                onClick={() => onOpenGallery({
                  title: publicTitle,
                  imageUrl: image,
                  images: galleryImages,
                })}
                className="w-full sm:w-20 h-40 sm:h-20 flex-shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]"
                aria-label={`View images for ${publicTitle}`}
              >
                <img
                  src={image}
                  alt={publicTitle}
                  className="w-full h-full rounded-xl object-cover border border-[#eef5ec]"
                />
              </button>
            ) : (
              <div className="w-full sm:w-16 h-40 sm:h-16 rounded-xl bg-[#f0f7ef] flex items-center justify-center flex-shrink-0 border border-[#eef5ec]">
                <ImageIcon className="w-6 h-6 text-[#6a7f6a]" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-3.5 h-3.5 text-[#f59e0b] fill-[#f59e0b] flex-shrink-0" />
                <span className="text-sm font-medium text-[#1a2e1a] truncate">
                  {publicTitle}
                </span>
              </div>

              {propertyId && (
                <p className="text-xs text-[#6a7f6a] mb-1">{propertyId}</p>
              )}

              {internalName && (
                <p className="text-xs text-[#7a3aa8] bg-[#f3e8ff] inline-flex items-center gap-1 px-2 py-0.5 rounded mb-1">
                  <span className="font-medium">Private:</span> {internalName}
                </p>
              )}

              <p className="text-xs text-[#6a7f6a]">
                {city}
                {city && area ? ' • ' : ''}
                {area}
              </p>
              <p className="text-xs text-[#6a7f6a] mt-1">
                {it.manuallySelected
                  ? 'Selected for this lead'
                  : <>Expressed interest on{' '}
                {it.expressedAt
                  ? new Date(it.expressedAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}</>}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-[#2d7a3a]">
                ₹{Number(price).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversationTab({ conversation }) {
  if (!conversation?.length)
    return <Empty icon={MessageSquare} text="No conversation yet" />;

  const groups = groupByDay(conversation);

  return (
    <div className="max-h-[640px] overflow-y-auto pr-1 space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Date separator — centered like WhatsApp */}
          <div className="flex items-center justify-center my-3">
            <span className="px-3 py-1 text-[11px] font-medium text-[#6a7f6a] bg-[#f0f7ef] rounded-full border border-[#e8f0e6] shadow-sm">
              {formatDayLabel(group.date)}
            </span>
          </div>

          {/* Messages for this day — no date inside, only time */}
          <div className="space-y-1.5">
            {group.items.map((c) => (
              <div
                key={c._id}
                className={`flex ${
                  c.direction === 'in' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 ${
                    c.direction === 'in'
                      ? 'bg-[#f0f7ef] text-[#1a2e1a] border border-[#e8f0e6] rounded-tl-md'
                      : 'bg-[#2d7a3a] text-white rounded-tr-md'
                  }`}
                >
                  {c.type === 'image' ? (
                    c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="rounded-lg max-w-full"
                      />
                    ) : (
                      <p className="text-sm italic">📷 Image</p>
                    )
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {c.text || '—'}
                    </p>
                  )}

                  {c.payload?.buttons && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.payload.buttons.map((b, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded ${
                            c.direction === 'in'
                              ? 'bg-white/50'
                              : 'bg-white/20'
                          }`}
                        >
                          {b.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Time only — no date */}
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      c.direction === 'in' ? 'text-[#6a7f6a]' : 'text-white/70'
                    }`}
                  >
                    {formatTime12h(c.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowUpsTab({ data }) {
  if (!data) return <Empty icon={Bell} text="No follow-up data" />;

  const statusMap = {
    pending: { label: 'Pending', tone: 'bg-[#fef7e0] text-[#b68b40]' },
    sent: { label: 'Sent', tone: 'bg-[#e6f0fb] text-[#2a6ba8]' },
    responded: { label: 'Responded', tone: 'bg-[#e8f5e6] text-[#2d7a3a]' },
    converted: { label: 'Converted', tone: 'bg-[#e8f5e6] text-[#2d7a3a]' },
    unsubscribed: {
      label: 'Unsubscribed',
      tone: 'bg-[#fde8e8] text-[#c0392b]',
    },
  };
  const s = statusMap[data.status] || statusMap.pending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SmallStat
          label="Status"
          value={
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.tone}`}
            >
              {s.label}
            </span>
          }
        />
        <SmallStat label="Follow-ups Sent" value={data.count || 0} />
        <SmallStat
          label="Last Sent"
          value={
            data.lastSentAt
              ? new Date(data.lastSentAt).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
        />
        <SmallStat label="Stuck At Step" value={data.stuckAtStep || '—'} />
      </div>

      {data.messages?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-2">
            Follow-up History
          </p>
          <div className="space-y-2">
            {data.messages.map((m) => (
              <div
                key={m._id}
                className="border border-[#eef5ec] rounded-xl p-3 bg-[#fafffa]"
              >
                <p className="text-xs text-[#6a7f6a] mb-1">
                  {new Date(m.at).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-[#1a2e1a] whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Site Visits — now a table ---------- */
function VisitsTab({ visits }) {
  if (!visits?.length) return <Empty icon={Calendar} text="No site visits yet" />;

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="bg-[#fafffa] border-b border-[#e8f0e6]">
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Property
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Date
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Time
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Channel Partner
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr
              key={v._id}
              className="border-b border-[#eef5ec] hover:bg-[#fafffa] transition-colors"
            >
              <td className="px-4 py-3 text-sm text-[#1a2e1a]">
                {v.property?.title || v.propertyTitle || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f]">
                {formatDate(v.scheduledDate)}
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f]">
                {formatTime12h(v.scheduledDate)}
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f]">
                {v.channelPartnerName || '—'}
              </td>
              <td className="px-4 py-3">
                <VisitStatusBadge status={v.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisitStatusBadge({ status }) {
  const map = {
    scheduled: {
      bg: 'bg-[#e6f0fb]',
      text: 'text-[#2a6ba8]',
      dot: 'bg-[#2a6ba8]',
      label: 'Scheduled',
    },
    pending: {
      bg: 'bg-[#fef7e0]',
      text: 'text-[#b68b40]',
      dot: 'bg-[#b68b40]',
      label: 'Pending',
    },
    completed: {
      bg: 'bg-[#e8f5e6]',
      text: 'text-[#2d7a3a]',
      dot: 'bg-[#2d7a3a]',
      label: 'Completed',
    },
    rescheduled: {
      bg: 'bg-[#f3e8ff]',
      text: 'text-[#7a3aa8]',
      dot: 'bg-[#7a3aa8]',
      label: 'Rescheduled',
    },
    cancelled: {
      bg: 'bg-[#fde8e8]',
      text: 'text-[#c0392b]',
      dot: 'bg-[#c0392b]',
      label: 'Cancelled',
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[#6a7f6a] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-[#1a2e1a] mt-0.5 break-words">
        {value || '—'}
      </p>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="bg-[#fafffa] border border-[#eef5ec] rounded-xl p-3 min-w-0">
      <p className="text-[10px] font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-[#1a2e1a] break-words">
        {value}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-10 h-10 text-[#6a7f6a]/40 mx-auto mb-3" />
      <p className="text-sm text-[#6a7f6a]">{text}</p>
    </div>
  );
}