'use client';
import { useAuth } from '@/lib/auth/useAuth';
import { useEffect, useState } from 'react';
import {
  Home, FolderOpen, MapPin, Pencil, CheckCircle, XCircle,
  User, IndianRupee, Image as ImageIcon,
} from 'lucide-react';

export default function RentOutListingsPage() {
  const { isOwner } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: '20',
      });
      if (city) params.set('city', city);
      const res = await fetch(`/api/properties/rent-out?${params}`);
      const json = await res.json();
      if (json.success) {
        setListings(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  const updateStatus = async (id, newStatus, label) => {
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setListings((prev) =>
          prev.map((l) => (l._id === id ? { ...l, status: newStatus } : l))
        );
        setSelected(null);
        setToast({ type: 'success', message: `${label} successfully` });
        setTimeout(() => setToast(null), 2500);
      } else {
        setToast({ type: 'error', message: `Failed to ${label.toLowerCase()}` });
        setTimeout(() => setToast(null), 2500);
      }
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: `Failed to ${label.toLowerCase()}` });
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Page Header */}
      <div className="mb-6 mt-16 md:mt-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a]">
          Rent Out Property Requests
        </h1>
        <p className="text-sm text-[#4f6b4f] mt-1">
          Properties submitted by landlords through WhatsApp
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 left-6 sm:left-auto z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-[#e8f5e6] text-[#2d7a3a] border border-[#c7e5c0]'
              : 'bg-[#fde8e8] text-[#c0392b] border border-[#f5c6c6]'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm mb-8">
        <div className="px-3 sm:px-5 py-4 border-b border-[#e8f0e6] flex items-center justify-between bg-[#fafffa]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Home className="w-4 h-4 text-[#2d7a3a] flex-shrink-0" />
            <h2 className="text-sm font-semibold text-[#1a2e1a] truncate">
              Rent Out Requests
            </h2>
            <span className="text-xs text-[#6a7f6a] bg-[#f0f7ef] px-2 py-0.5 rounded-full flex-shrink-0">
              {pagination.total} total
            </span>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#fafffa]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Image</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Category</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Property Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">City / Area</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Owner Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Expected Rent</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Furnishing</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-[#6a7f6a]">Loading listings...</p>
                    </div>
                  </td>
                </tr>
              ) : listings.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={9} className="text-center py-12 text-[#6a7f6a] text-sm">
                    <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
                    No rent-out requests found
                  </td>
                </tr>
              ) : (
                listings.map((p) => (
                  <tr key={p._id} className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors">
                    <td className="px-5 py-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} className="w-14 h-14 rounded-xl object-cover border border-[#e8f0e6]" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#f0f7ef] flex items-center justify-center border border-[#e8f0e6]">
                          <ImageIcon className="w-5 h-5 text-[#a8bfa8]" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#f0f7ef] text-[#2d7a3a]">
                        <Home className="w-3 h-3" />
                        {p.propertyType === 'commercial' ? 'Commercial' : 'Residential'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-[#1a2e1a] capitalize">
                        {p.propertySubType?.replace(/_/g, ' ') || '—'}
                      </div>
                      <div className="text-xs text-[#6a7f6a] uppercase">{p.configuration || ''}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm text-[#1a2e1a] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#6a7f6a]" />
                        {p.area || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-[#1a2e1a] flex items-center gap-1.5">
                        <User className="w-3 h-3 text-[#6a7f6a]" />
                        {p.ownerName || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold text-[#1a2e1a] flex items-center gap-1">
                        <IndianRupee className="w-3 h-3 text-[#2d7a3a]" />
                        {Number(p.price || 0).toLocaleString('en-IN')}
                        <span className="text-xs font-normal text-[#6a7f6a]">/mo</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-[#4f6b4f] capitalize">
                        {p.furnishing?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelected(p)}
                          title="Edit / View"
                          className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#f0f7ef] hover:border-[#2d7a3a] transition-colors group"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                        </button>
                        <button
                          onClick={() => updateStatus(p._id, 'available', 'Approved')}
                          disabled={p.status === 'available'}
                          title="Approve"
                          className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#e8f5e6] hover:border-[#2d7a3a] transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                        </button>
                        <button
                          onClick={() => updateStatus(p._id, 'inactive', 'Denied')}
                          disabled={p.status === 'inactive'}
                          title="Deny"
                          className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#c0392b]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#eef5ec]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#6a7f6a] mt-3">Loading listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-[#6a7f6a] text-sm">
              <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
              No rent-out requests found
            </div>
          ) : (
            listings.map((p) => (
              <div key={p._id} className="p-4 space-y-3">
                <div className="flex gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} className="w-16 h-16 rounded-xl object-cover border border-[#e8f0e6] flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#f0f7ef] flex items-center justify-center border border-[#e8f0e6] flex-shrink-0">
                      <ImageIcon className="w-5 h-5 text-[#a8bfa8]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1a2e1a] truncate capitalize">
                      {p.propertySubType?.replace(/_/g, ' ') || 'Property'}
                    </p>
                    <p className="text-xs text-[#6a7f6a] truncate mt-0.5">{p.area || '—'}</p>
                    <p className="text-sm font-bold text-[#1a2e1a] mt-1">
                      ₹{Number(p.price || 0).toLocaleString('en-IN')}
                      <span className="text-xs font-normal text-[#6a7f6a]">/mo</span>
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Owner</p>
                    <p className="text-[#1a2e1a] mt-0.5 truncate">{p.ownerName || 'Unknown'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Furnishing</p>
                    <p className="text-[#1a2e1a] mt-0.5 capitalize truncate">
                      {p.furnishing?.replace(/_/g, ' ') || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#eef5ec]">
                  <button
                    onClick={() => setSelected(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#2d7a3a] bg-[#e8f5e6] rounded-lg"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => updateStatus(p._id, 'available', 'Approved')}
                    disabled={p.status === 'available'}
                    className="p-2 text-[#2d7a3a] bg-[#e8f5e6] rounded-lg disabled:opacity-40"
                    aria-label="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateStatus(p._id, 'inactive', 'Denied')}
                    disabled={p.status === 'inactive'}
                    className="p-2 text-[#c0392b] bg-[#fde8e8] rounded-lg disabled:opacity-40"
                    aria-label="Deny"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="px-3 sm:px-5 py-4 border-t border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between gap-2">
            <span className="text-xs text-[#6a7f6a]">Page {page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg text-[#1a2e1a] hover:bg-[#f0f7ef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg text-[#1a2e1a] hover:bg-[#f0f7ef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / Edit Modal — bottom sheet on mobile */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-[#e8f5e6] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-[#2d7a3a]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-[#1a2e1a] truncate">
                    {selected.title}
                  </h2>
                  <p className="text-xs text-[#6a7f6a] font-mono truncate">
                    {selected.propertyId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[#6a7f6a] hover:text-[#1a2e1a] transition-colors p-1 flex-shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {selected.images?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                  {selected.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt=""
                      className="w-full h-24 object-cover rounded-xl border border-[#e8f0e6]"
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-32 bg-[#f0f7ef] rounded-xl border border-[#e8f0e6] flex items-center justify-center mb-6">
                  <ImageIcon className="w-6 h-6 text-[#a8bfa8]" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Field label="Status" value={<StatusBadge status={selected.status} />} />
                <Field
                  label="Category"
                  value={selected.propertyType === 'commercial' ? 'Commercial' : 'Residential'}
                />
                <Field label="Property Type" value={selected.propertySubType?.replace(/_/g, ' ')} />
                <Field label="Configuration" value={selected.configuration} />
                <Field label="Location" value={selected.location} />
                <Field label="City / Area" value={`${selected.area}, ${selected.city}`} />
                <Field
                  label="Expected Rent"
                  value={`₹${Number(selected.price || 0).toLocaleString('en-IN')}/mo`}
                />
                <Field label="Area" value={`${selected.areaSqft} Sq.Ft.`} />
                <Field label="Furnishing" value={selected.furnishing?.replace(/_/g, ' ')} />
                <Field label="Owner" value={selected.ownerName} />
                <Field label="Owner Phone" value={selected.ownerPhone} />
                <Field
                  label="Created"
                  value={new Date(selected.createdAt).toLocaleString()}
                />
              </div>

              {selected.description && (
                <div className="mt-6">
                  <div className="text-xs text-[#6a7f6a] mb-1 uppercase tracking-wider">Description</div>
                  <p className="text-sm text-[#4f6b4f] bg-[#fafffa] border border-[#e8f0e6] rounded-xl p-3">
                    {selected.description}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-6 pt-6 border-t border-[#e8f0e6]">
                {selected.status !== 'available' && (
                  <button
                    onClick={() => updateStatus(selected._id, 'available', 'Approved')}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Listing
                  </button>
                )}
                {selected.status !== 'rented' && (
                  <button
                    onClick={() => updateStatus(selected._id, 'rented', 'Marked as Rented')}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-[#6fbf73] hover:bg-[#5da861] text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Mark as Rented
                  </button>
                )}
                {selected.status !== 'inactive' && (
                  <button
                    onClick={() => updateStatus(selected._id, 'inactive', 'Denied')}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] hover:text-[#c0392b] text-[#4f6b4f] rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Deny
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending:   { bg: 'bg-[#fef7e0]', text: 'text-[#b68b40]', dot: 'bg-[#b68b40]', label: 'Pending' },
    available: { bg: 'bg-[#e8f5e6]', text: 'text-[#2d7a3a]', dot: 'bg-[#2d7a3a]', label: 'Approved' },
    rented:    { bg: 'bg-[#e6f0fb]', text: 'text-[#2a6ba8]', dot: 'bg-[#2a6ba8]', label: 'Rented' },
    inactive:  { bg: 'bg-[#fde8e8]', text: 'text-[#c0392b]', dot: 'bg-[#c0392b]', label: 'Denied' },
    deleted:   { bg: 'bg-[#f0f0f0]', text: 'text-[#6a7f6a]', dot: 'bg-[#6a7f6a]', label: 'Deleted' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0 ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
      {s.label}
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-[#6a7f6a] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium text-[#1a2e1a] break-words">{value || '—'}</div>
    </div>
  );
}