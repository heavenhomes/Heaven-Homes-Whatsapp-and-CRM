// lib/models/Activity.js
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    // Who did it. 'system' for automated events (e.g., WhatsApp bot).
    actorType: {
      type: String,
      enum: ['owner', 'channel_partner', 'system'],
      default: 'system',
      index: true,
    },
    actorName: { type: String, default: 'System' },
    actorUsername: { type: String, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },

    // What happened
    action: {
      type: String,
      required: true,
      index: true,
      // Examples: 'lead.created', 'lead.updated', 'lead.deleted',
      //           'property.created', 'property.sold', 'property.deleted',
      //           'site_visit.created', 'site_visit.completed',
      //           'team_member.created', 'auth.login', 'auth.logout'
    },

    // Category for filtering: 'lead' | 'property' | 'site_visit' | 'team' | 'auth'
    category: {
      type: String,
      required: true,
      index: true,
    },

    // Human-readable description
    description: { type: String, required: true },

    // The doc affected
    targetType: { type: String, default: '' },   // 'Lead' | 'Property' | 'SiteVisit' | 'TeamMember'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    targetLabel: { type: String, default: '' },  // e.g., lead name, property title

    // Optional: what changed. e.g. { assignedTo: { from: 'X', to: 'Y' } }
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Extra info
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Optional IP / user-agent
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },

    // Severity for the UI: 'info' | 'success' | 'warning' | 'danger'
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'danger'],
      default: 'info',
    },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ category: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

const Activity =
  mongoose.models.Activity || mongoose.model('Activity', activitySchema);

export default Activity;