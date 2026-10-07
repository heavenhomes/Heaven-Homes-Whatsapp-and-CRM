// app/broadcast/page.js
'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  History,
  Users,
  MessageSquare,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Target,
  Phone,
  Building2,
  Percent,
  DollarSign,
  Filter,
  X,
  Trash2
} from 'lucide-react';

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  
  // Discount property fields
  const [discountProperty, setDiscountProperty] = useState({
    location: '',
    propertyType: '',
    originalPrice: '',
    discount: '',
    newPrice: '',
    areaSqft: ''
  });

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch('/api/broadcast');
      const data = await res.json();
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching broadcasts:', err);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const payload = {
        message,
        filters: {
          city: city || undefined,
          propertyType: propertyType || undefined,
          budgetRange: budgetRange || undefined
        }
      };

      // If discount form is shown, include property data
      if (showDiscountForm) {
        payload.propertyData = discountProperty;
        payload.broadcastType = 'discount';
      }

      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ Broadcast sent to ${data.totalRecipients} recipients!`);
        setMessage('');
        setCity('');
        setPropertyType('');
        setBudgetRange('');
        setDiscountProperty({
          location: '',
          propertyType: '',
          originalPrice: '',
          discount: '',
          newPrice: '',
          areaSqft: ''
        });
        fetchBroadcasts();
      } else {
        alert('❌ Failed to send broadcast: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('❌ Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteBroadcast = async (id) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;
    
    try {
      await fetch(`/api/broadcast?id=${id}`, { method: 'DELETE' });
      fetchBroadcasts();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'sent': { label: 'Sent', icon: CheckCircle, className: 'bg-[#e8f5e6] text-[#2d7a3a]' },
      'partial': { label: 'Partial', icon: AlertCircle, className: 'bg-[#fef7e0] text-[#b68b40]' },
      'pending': { label: 'Pending', icon: Clock, className: 'bg-[#e8f0f7] text-[#4a6a8a]' },
      'failed': { label: 'Failed', icon: AlertCircle, className: 'bg-[#fee8e8] text-[#b33a3a]' }
    };
    const config = statusMap[status] || statusMap['pending'];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8faf7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#4f6b4f] text-sm font-medium">Loading broadcasts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Page Header */}
      <div className="mb-6 mt-14 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#1a2e1a] flex items-center gap-2">
              <span className="w-2 h-8 bg-[#2d7a3a] rounded-full mr-2"></span>
              Broadcast Dashboard
            </h1>
            <p className="text-sm text-[#4f6b4f] mt-1 ml-4">Send messages to your leads and track broadcast history</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiscountForm(!showDiscountForm)}
              className={`text-xs px-4 py-2 rounded-full border shadow-sm flex items-center gap-2 transition-colors ${
                showDiscountForm 
                  ? 'bg-[#2d7a3a] text-white border-[#2d7a3a]' 
                  : 'bg-white border-[#e8f0e6] text-[#4f6b4f] hover:border-[#2d7a3a]'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              {showDiscountForm ? 'Hide Discount' : 'Discount Offer'}
            </button>
            <span className="text-xs bg-white px-4 py-2 rounded-full border border-[#e8f0e6] text-[#4f6b4f] shadow-sm flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#2d7a3a]" />
              {broadcasts.length} Broadcasts
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Send Broadcast Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-[#e8f0e6] p-5 shadow-sm sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto">
            <h2 className="text-sm font-semibold text-[#1a2e1a] mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-[#2d7a3a]" />
              Send New Broadcast
            </h2>
            
            <form onSubmit={handleSendBroadcast}>
              <div className="space-y-4">
                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-[#4f6b4f] mb-1.5">
                    Message <span className="text-[#b33a3a]">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows="4"
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-[#fafffa] resize-none"
                    placeholder="Type your broadcast message here..."
                    required
                  />
                  <p className="text-xs text-[#6a7f6a] mt-1.5">
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    {message.length} characters
                  </p>
                </div>

                {/* Discount Property Form */}
                {showDiscountForm && (
                  <div className="border border-[#2d7a3a]/20 rounded-xl p-3 bg-[#f8faf7] space-y-3">
                    <div className="flex items-center gap-2 text-[#2d7a3a]">
                      <Percent className="w-4 h-4" />
                      <span className="text-xs font-semibold">Discount Property Details</span>
                    </div>
                    
                    <input
                      type="text"
                      placeholder="Location"
                      value={discountProperty.location}
                      onChange={(e) => setDiscountProperty({...discountProperty, location: e.target.value})}
                      className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                    />
                    
                    <input
                      type="text"
                      placeholder="Property Type (e.g., 2BHK Apartment)"
                      value={discountProperty.propertyType}
                      onChange={(e) => setDiscountProperty({...discountProperty, propertyType: e.target.value})}
                      className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Original Price"
                        value={discountProperty.originalPrice}
                        onChange={(e) => setDiscountProperty({...discountProperty, originalPrice: e.target.value})}
                        className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Discount %"
                        value={discountProperty.discount}
                        onChange={(e) => setDiscountProperty({...discountProperty, discount: e.target.value})}
                        className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                      />
                    </div>
                    
                    <input
                      type="text"
                      placeholder="New Price"
                      value={discountProperty.newPrice}
                      onChange={(e) => setDiscountProperty({...discountProperty, newPrice: e.target.value})}
                      className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                    />
                    
                    <input
                      type="text"
                      placeholder="Area (sq.ft)"
                      value={discountProperty.areaSqft}
                      onChange={(e) => setDiscountProperty({...discountProperty, areaSqft: e.target.value})}
                      className="w-full px-3 py-1.5 border border-[#e8f0e6] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-white"
                    />
                  </div>
                )}

                {/* Filters */}
                <div>
                  <label className="block text-xs font-medium text-[#4f6b4f] mb-1.5">
                    <Filter className="w-3.5 h-3.5 inline mr-1" />
                    Filters <span className="text-[#6a7f6a] font-normal">(optional)</span>
                  </label>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-[#fafffa]"
                      placeholder="Filter by City"
                    />
                    
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-[#fafffa]"
                    >
                      <option value="">All Property Types</option>
                      <option value="buy">Buy</option>
                      <option value="rent">Rent</option>
                      <option value="commercial">Commercial</option>
                    </select>
                    
                    <select
                      value={budgetRange}
                      onChange={(e) => setBudgetRange(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] bg-[#fafffa]"
                    >
                      <option value="">All Budgets</option>
                      <option value="low">₹10-50 Lakh</option>
                      <option value="mid">₹50L-1Cr</option>
                      <option value="high">₹1Cr+</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#2d7a3a] hover:bg-[#23682e] text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Broadcast
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-4 border-t border-[#eef5ec]">
              <p className="text-xs text-[#6a7f6a] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Broadcast will be sent to all completed leads
                {city && ` in ${city}`}
                {propertyType && ` (${propertyType})`}
              </p>
            </div>
          </div>
        </div>

        {/* Broadcast History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-[#e8f0e6] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1a2e1a] flex items-center gap-2">
                <History className="w-4 h-4 text-[#2d7a3a]" />
                Broadcast History
              </h2>
              <span className="text-xs text-[#6a7f6a] bg-[#f0f7ef] px-2.5 py-1 rounded-full">
                {broadcasts.length} total
              </span>
            </div>

            {broadcasts.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-[#6a7f6a]/30 mx-auto mb-3" />
                <p className="text-sm text-[#6a7f6a]">No broadcasts sent yet</p>
                <p className="text-xs text-[#6a7f6a]/70 mt-1">Send your first broadcast using the form</p>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcasts.map((broadcast) => (
                  <div key={broadcast._id} className="border border-[#eef5ec] rounded-xl p-4 hover:bg-[#fafffa] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#e8f5e6] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {broadcast.broadcastType === 'discount' ? (
                              <Percent className="w-4 h-4 text-[#2d7a3a]" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-[#2d7a3a]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-[#1a2e1a] truncate max-w-[200px]">
                                {broadcast.message?.slice(0, 50) || 'No message'}
                                {broadcast.message?.length > 50 ? '...' : ''}
                              </span>
                              {getStatusBadge(broadcast.status)}
                              {broadcast.broadcastType === 'discount' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fef7e0] text-[#b68b40] rounded-full text-xs">
                                  <Percent className="w-3 h-3" />
                                  Discount
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#6a7f6a]">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(broadcast.createdAt).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(broadcast.createdAt).toLocaleTimeString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {broadcast.sentCount || 0} / {broadcast.totalRecipients || broadcast.recipients?.length || 0} sent
                              </span>
                              {broadcast.filters?.city && (
                                <span className="flex items-center gap-1 bg-[#f0f7ef] px-2 py-0.5 rounded-full">
                                  <MapPin className="w-3 h-3" />
                                  {broadcast.filters.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteBroadcast(broadcast._id)}
                          className="p-1.5 text-[#b33a3a] hover:bg-[#fee8e8] rounded-lg transition-colors"
                          title="Delete broadcast"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}