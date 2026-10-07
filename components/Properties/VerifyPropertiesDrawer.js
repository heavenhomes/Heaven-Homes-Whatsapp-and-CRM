"use client";
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheck, MapPin, Home, Image as ImageIcon,
  Check, X, ChevronLeft, ChevronRight, Loader2, Phone, User,
} from 'lucide-react';

const SUBTYPE_LABEL = {
  apartment: 'Apartment / Flat',
  flat: 'Flat',
  house: 'House / Villa',
  villa: 'Villa',
  builder_floor: 'Builder Floor',
  studio: 'Studio',
  penthouse: 'Penthouse',
  farmhouse: 'Farmhouse',
  pg: 'PG',
  office: 'Office Space',
  shop: 'Shop / Retail',
  showroom: 'Showroom',
  warehouse: 'Warehouse / Godown',
  industrial: 'Industrial',
  coworking: 'Co-working Space',
  factory: 'Factory',
};

export default function VerifyPropertiesDrawer({ isOpen, onClose, onChanged }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageErrors, setImageErrors] = useState({});
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 8,
    pages: 0,
  });

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      const res = await fetch(`/api/properties/pending?${params}`);
      const data = await res.json();

      if (data.success) {
        setProperties(Array.isArray(data.data) ? data.data : []);
        setPagination((p) => ({
          ...p,
          total: data.pagination?.total ?? 0,
          page: data.pagination?.page ?? 1,
          pages: data.pagination?.pages ?? 0,
        }));
      } else {
        toast.error('Failed to load pending properties');
        setProperties([]);
      }
    } catch (err) {
      console.error('[verify] fetch error', err);
      toast.error('Failed to load pending properties');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  // Reset to page 1 + fetch each time the drawer opens
  useEffect(() => {
    if (isOpen) {
      setPagination((p) => ({ ...p, page: 1 }));
      setImageErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pagination.page, pagination.limit]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      return () => document.body.classList.remove('modal-open');
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleDecision = async (property, decision) => {
    const newStatus = decision === 'approve' ? 'available' : 'rejected';
    const label = decision === 'approve' ? 'approve' : 'reject';

    if (decision === 'reject') {
      const ok = window.confirm(
        `Reject "${property.title}"? It will not appear in the property listing.`
      );
      if (!ok) return;
    }

    setActingOn(property._id);
    try {
      const res = await fetch(`/api/properties/${property._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to ${label} property`);
        return;
      }

      toast.success(decision === 'approve' ? 'Property approved' : 'Property rejected');
      setProperties((prev) => prev.filter((p) => p._id !== property._id));
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
      onChanged?.();
    } catch (err) {
      console.error('[verify] decision error', err);
      toast.error(`Error trying to ${label} property`);
    } finally {
      setActingOn(null);
    }
  };

  const handleImageError = (propertyId) => {
    setImageErrors((prev) => ({ ...prev, [propertyId]: true }));
  };

  const formatPrice = (price, propertyType) => {
    const n = Number(price) || 0;
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
    return propertyType === 'rent' || propertyType === 'commercial_rent'
      ? `${formatted}/mo`
      : formatted;
  };

  const getSubTypeLabel = (subType) =>
    subType ? SUBTYPE_LABEL[subType] || subType : 'Property';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[61] bg-[#f8faf7] w-full sm:max-w-3xl lg:max-w-4xl shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-[#e8f0e6] px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#e8f5e6] rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#2d7a3a]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-[#1a2e1a] truncate">
                Property Verification
              </h2>
              <p className="text-xs text-[#6a7f6a] truncate">
                Review properties submitted by channel partners & WhatsApp users
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f5e6] border border-[#c9e5c3] rounded-full text-xs text-[#2d7a3a] font-medium">
              {pagination.total} pending
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#f0f7ef] text-[#6a7f6a] hover:text-[#1a2e1a] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="bg-white rounded-2xl border border-[#e8f0e6] shadow-sm p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#6a7f6a]">Loading pending properties...</p>
              </div>
            </div>
          ) : properties.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e8f0e6] shadow-sm p-12 text-center">
              <div className="w-20 h-20 bg-[#f0f7ef] rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-10 h-10 text-[#2d7a3a]" />
              </div>
              <h3 className="text-lg font-medium text-[#1a2e1a] mb-2">
                All caught up!
              </h3>
              <p className="text-sm text-[#6a7f6a]">
                There are no properties waiting for verification right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((property) => {
                const allFeatures = Array.isArray(property.features) ? property.features : [];
                const features = allFeatures.slice(0, 3);
                const extra = allFeatures.length - features.length;
                const showImage = property.imageUrl && !imageErrors[property._id];
                const isActing = actingOn === property._id;

                const uploader = property.uploadedBy;
                const uploaderName =
                  uploader && typeof uploader === 'object' ? uploader.name : null;
                const uploaderUsername =
                  uploader && typeof uploader === 'object' ? uploader.username : null;

                return (
                  <div
                    key={property._id}
                    className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                  >
                    {/* Image */}
                    <div className="relative bg-[#f0f7ef] overflow-hidden flex-shrink-0 h-40 sm:h-44 w-full">
                      {showImage ? (
                        <img
                          src={property.imageUrl}
                          alt={property.title || 'Property'}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={() => handleImageError(property._id)}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-[#fafffa] to-[#f0f7ef]">
                          <ImageIcon className="w-10 h-10 text-[#6a7f6a]/40" />
                        </div>
                      )}

                      <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold shadow-sm bg-[#fff5d6] text-[#a67c00]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a67c00]" />
                        Pending Review
                      </span>

                      {showImage && (
                        <button
                          onClick={() => setSelectedImage(property.imageUrl)}
                          className="absolute bottom-2 right-2 p-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                          aria-label="Preview image"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#1a2e1a]" />
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 flex-1 flex flex-col">
                      {/* Source + uploader */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[10px] text-[#6a7f6a] uppercase tracking-wide font-medium truncate">
                          {property.source === 'whatsapp_bot'
                            ? 'Submitted via WhatsApp'
                            : 'Submitted by channel partner'}
                        </p>
                      </div>

                      {uploaderName && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7a3aa8] bg-[#f3e8ff] px-2 py-1 rounded-lg mb-2">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium truncate">
                            {uploaderName}
                            {uploaderUsername ? (
                              <span className="text-[#7a3aa8]/70 font-normal">
                                {' '}
                                · @{uploaderUsername}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      )}

                      <h3 className="text-sm font-semibold text-[#1a2e1a] mb-1 leading-snug line-clamp-2">
                        {property.title || 'Untitled Property'}
                      </h3>

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 text-[11px] text-[#4f6b4f] min-w-0">
                          <MapPin className="w-3 h-3 text-[#6a7f6a] flex-shrink-0" />
                          <span className="truncate">
                            {[property.area, property.city].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#1a2e1a] whitespace-nowrap">
                          {formatPrice(property.price, property.propertyType)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#4f6b4f] mb-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <Home className="w-3 h-3 text-[#6a7f6a]" />
                          <span className="truncate">
                            {getSubTypeLabel(property.propertySubType)}
                          </span>
                        </div>
                        {property.areaSqft ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[#6a7f6a]">📐</span>
                            <span className="truncate">{property.areaSqft} Sq Ft</span>
                          </div>
                        ) : (
                          <div className="invisible">—</div>
                        )}
                      </div>

                      {(property.ownerName || property.ownerPhone) && (
                        <div className="text-[11px] text-[#4f6b4f] mb-2 truncate">
                          {property.ownerName ? (
                            <span className="font-medium">{property.ownerName}</span>
                          ) : null}
                          {property.ownerName && property.ownerPhone ? ' · ' : ''}
                          {property.ownerPhone ? <span>{property.ownerPhone}</span> : null}
                        </div>
                      )}

                      {/* Features */}
                      <div className="flex flex-wrap gap-1 mb-2 overflow-hidden max-h-[26px]">
                        {features.length > 0 ? (
                          <>
                            {features.map((f, i) => (
                              <span
                                key={`${property._id}-feat-${i}`}
                                className="text-[10px] text-[#2d7a3a] bg-[#e8f5e6] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              >
                                {f}
                              </span>
                            ))}
                            {extra > 0 && (
                              <span className="text-[10px] text-[#6a7f6a] bg-[#f0f7ef] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                +{extra}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-transparent select-none">—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-[#eef5ec]">
                        <button
                          onClick={() => handleDecision(property, 'reject')}
                          disabled={isActing}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#c0392b] bg-[#fde8e8] hover:bg-[#fbd5d5] rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isActing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                          Reject
                        </button>
                        <button
                          onClick={() => handleDecision(property, 'approve')}
                          disabled={isActing}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-[#2d7a3a] hover:bg-[#23682e] rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isActing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-[#e8f0e6] px-4 py-3 shadow-sm">
              <div className="text-xs text-[#6a7f6a] text-center sm:text-left">
                Page {pagination.page} of {pagination.pages} · {pagination.total} pending
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg disabled:opacity-50 hover:bg-[#fafffa] transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: Math.min(p.pages, p.page + 1) }))
                  }
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg disabled:opacity-50 hover:bg-[#fafffa] transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Image preview */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-[#1a2e1a]/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-[#e8f5e6] p-2"
              aria-label="Close preview"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedImage}
              alt="Property"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}