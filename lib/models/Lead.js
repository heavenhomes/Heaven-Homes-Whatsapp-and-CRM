import mongoose from 'mongoose';
import { toTitleCase } from '@/lib/place-names';

const leadSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String },
    email: { type: String, lowercase: true, trim: true },
    name: { type: String },
    source: { type: String, enum: ['whatsapp_bot', 'manual'], default: 'whatsapp_bot' },

    leadType: { type: String, enum: ['seeker', 'lister'], default: 'seeker' },
    preferredLanguage: { type: String, enum: ['en', 'hi', 'gu'], default: 'en' },

    city: { type: String },
    area: { type: String },

    propertyCategory: {
      type: String,
      enum: ['purchase', 'rent_lease', 'rent_out'],
    },
    purchaseType: {
      type: String,
      enum: [
        'residential_buy',
        'commercial_buy',
        'residential_rent',
        'commercial_rent',
      ],
    },
    propertyType: { type: String },
    propertySubType: { type: String },
    rentTypeLabel: { type: String },
    rentBudgetLabel: { type: String },
    configuration: { type: String },
    budgetRange: { type: String },
    timeline: { type: String },
    furnishing: { type: String },
    investmentType: { type: String },
    siteVisit: { type: String },
    spaceSize: { type: String },

    interested: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    ownedPropertyDraft: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    listingDraft: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    lastIncomingMessageId: { type: String, default: '' },
    step: { type: String, default: 'askLanguage' },
    cityAttempts: { type: Number, default: 0 },
    areaAttempts: { type: Number, default: 0 },
    matchedProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    currentPropertyIndex: { type: Number, default: 0 },
    hadExactMatch: { type: Boolean, default: false },
    propertyIdSearch: { type: Boolean, default: false },

    followUpCount: { type: Number, default: 0 },
    lastFollowUp: { type: Date },
    followUpStatus: {
      type: String,
      enum: ['pending', 'sent', 'responded', 'converted', 'unsubscribed'],
      default: 'pending',
    },
    stuckAtStep: { type: String },
    becameInactiveAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    leadScore: { type: Number, default: 0 },
    reengagedAt: { type: Date },
    notes: { type: String },

    // ==================== CRM FIELDS ====================
    currentStatus: {
      type: String,
      enum: [
        'new',
        'follow_up',
        'active',
        'contacted',
        'interested',
        'site_visit_scheduled',
        'site_visit_completed',
        'lost',
        'converted',
      ],
      default: 'new',
      index: true,
    },
    assignedTo: { type: String, default: '' },

    // Property enquiries — one entry per completed qualification run.
    // NOTE: `_id` is auto-added by Mongoose for every subdoc; do NOT declare it.
    enquiries: {
      type: [
        new mongoose.Schema(
          {
            submittedAt: { type: Date, default: Date.now },
            city: String,
            area: String,
            purpose: String,
            propertyCategory: String,
            propertyType: String,
            configuration: String,
            size: String,
            budgetRange: String,
            budgetLabel: String,
            timeline: String,
            buyingPlan: String,
            furnishing: String,
            spaceSize: String,
            source: { type: String, enum: ['whatsapp_bot', 'manual'], default: 'whatsapp_bot' },
          },
          { _id: true }
        ),
      ],
      default: [],
    },

    // Every property the lead tapped "Interested" on.
    interestHistory: {
      type: [
        new mongoose.Schema(
          {
            property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
            propertyCode: String,
            propertyTitle: String,
            propertySnapshot: { type: mongoose.Schema.Types.Mixed },
            expressedAt: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },

    // Every CRM status change.
    statusHistory: {
      type: [
        new mongoose.Schema(
          {
            from: String,
            to: String,
            changedAt: { type: Date, default: Date.now },
            changedBy: String,
            note: String,
          },
          { _id: true }
        ),
      ],
      default: [],
    },

    // Full WhatsApp conversation log.
    conversation: {
      type: [
        new mongoose.Schema(
          {
            direction: { type: String, enum: ['in', 'out'] },
            type: String,
            text: String,
            payload: { type: mongoose.Schema.Types.Mixed },
            mediaId: String,
            imageUrl: String,
            at: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes
leadSchema.index({ step: 1, lastActivityAt: 1 });
leadSchema.index({ followUpStatus: 1, followUpCount: 1, lastActivityAt: 1 });
leadSchema.index({ createdAt: 1, step: 1 });
leadSchema.index({ city: 1, area: 1 });
leadSchema.index({ propertyType: 1, configuration: 1 });
leadSchema.index({ leadType: 1, propertyCategory: 1 });
leadSchema.index({ ownedPropertyDraft: 1 });
leadSchema.index({ currentStatus: 1, assignedTo: 1 });
leadSchema.index({ 'enquiries.submittedAt': -1 });

leadSchema.pre('save', function () {
  if (typeof this.city === 'string' && this.city) this.city = toTitleCase(this.city);
  if (typeof this.area === 'string' && this.area) this.area = toTitleCase(this.area);
});

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
export default Lead;