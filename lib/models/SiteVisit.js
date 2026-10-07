import mongoose from 'mongoose';

const siteVisitSchema = new mongoose.Schema(
  {
    // Which lead booked this visit
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    // The property they want to visit
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },

    // Denormalized for fast list rendering
    leadName: { type: String, default: '' },
    leadPhone: { type: String, default: '' },
    propertyTitle: { type: String, default: '' },
    propertyCode: { type: String, default: '' },

    // When the visit is scheduled
    scheduledDate: { type: Date, required: true, index: true },
    scheduledTime: { type: String, default: '' }, // e.g. "11:00 AM"
    // Free-text the lead typed in WhatsApp (kept for audit)
    rawPreferredDateTime: { type: String, default: '' },

    // Channel partner handling this visit
    channelPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // remove this ref if you don't have a User model
      default: null,
      index: true,
    },
    channelPartnerName: { type: String, default: '' },

    // Status flow: scheduled -> completed / rescheduled / cancelled
    status: {
      type: String,
      enum: ['scheduled', 'pending', 'completed', 'rescheduled', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    // Previous date/time if rescheduled
    rescheduledFrom: {
      date: Date,
      time: String,
      rescheduledAt: Date,
    },

    // How the visit was created
    source: {
      type: String,
      enum: ['whatsapp_bot', 'admin'],
      default: 'whatsapp_bot',
    },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

siteVisitSchema.index({ status: 1, scheduledDate: 1 });
siteVisitSchema.index({ lead: 1, property: 1 });

const SiteVisit =
  mongoose.models.SiteVisit || mongoose.model('SiteVisit', siteVisitSchema);

export default SiteVisit;