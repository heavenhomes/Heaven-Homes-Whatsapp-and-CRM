import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import { logActivity } from '@/lib/activity/log';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

const ALLOWED_LEAD_FIELDS = [
  'phone', 'phoneNumber', 'email', 'name', 'city', 'area',
  'leadType', 'preferredLanguage', 'propertyCategory', 'purchaseType',
  'propertyType', 'propertySubType', 'configuration', 'budgetRange',
  'rentBudgetLabel', 'rentTypeLabel', 'timeline', 'furnishing',
  'investmentType', 'siteVisit', 'shiftingDate', 'spaceSize',
  'interested', 'ownedPropertyDraft', 'listingDraft',
  'step', 'cityAttempts', 'areaAttempts',
  'matchedProperties', 'currentPropertyIndex',
  'followUpStatus', 'followUpCount', 'notes',
];

// CRM fields admins can edit
const CRM_FIELDS = ['currentStatus', 'assignedTo'];

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

function transformLead(lead) {
  return {
    _id: lead._id,
    name: lead.name || 'Not provided',
    phone: lead.phone,
    phoneNumber: lead.phoneNumber || 'Not provided',
    email: lead.email || null,
    leadType: lead.leadType,
    preferredLanguage: lead.preferredLanguage || 'en',
    city: lead.city || 'Not provided',
    area: lead.area || 'Not provided',
    propertyCategory: lead.propertyCategory || 'Not provided',
    purchaseType: lead.purchaseType || 'Not provided',
    propertyType: lead.propertyType || 'Not provided',
    propertySubType: lead.propertySubType || null,
    configuration: lead.configuration || 'Not provided',
    budgetRange: lead.budgetRange || 'Not provided',
    rentBudgetLabel: lead.rentBudgetLabel || null,
    rentTypeLabel: lead.rentTypeLabel || null,
    timeline: lead.timeline || 'Not provided',
    furnishing: lead.furnishing || 'Not provided',
    investmentType: lead.investmentType || 'Not provided',
    siteVisit: lead.siteVisit || null,
    shiftingDate: lead.shiftingDate || null,
    spaceSize: lead.spaceSize || null,
    step: lead.step,
    isCompleted: lead.step === 'completed',
    interested: lead.interested || null,
    matchedProperties: lead.matchedProperties || [],
    ownedPropertyDraft: lead.ownedPropertyDraft || null,
    listingDraft: lead.listingDraft || {},
    currentPropertyIndex: lead.currentPropertyIndex || 0,
    followUpStatus: lead.followUpStatus,
    followUpCount: lead.followUpCount,
    lastActivityAt: lead.lastActivityAt,
    currentStatus: lead.currentStatus || 'new',
    assignedTo: lead.assignedTo || '',
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// GET — fetch one lead. NO body parsing here.
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }

    const lead = await Lead.findById(id)
      .populate('matchedProperties', 'propertyId title city area price configuration imageUrl status')
      .populate('interested', 'propertyId title city area price configuration imageUrl status')
      .populate('ownedPropertyDraft', 'propertyId title city area price configuration imageUrl status images');

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: transformLead(lead) });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead', message: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — update one lead. Body required here.
// ---------------------------------------------------------------------------
export async function PUT(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }

    // Parse body — wrap in try/catch so empty body doesn't 500
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
    }
console.log('[lead PUT] raw body:', JSON.stringify(body));
    const existing = await Lead.findById(id).lean();
    if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const cleanBody = {};
    for (const key of ALLOWED_LEAD_FIELDS) {
      if (body[key] !== undefined) cleanBody[key] = body[key];
    }
    for (const key of CRM_FIELDS) {
      if (body[key] !== undefined) cleanBody[key] = body[key];
    }

    // If currentStatus is changing, append to statusHistory
    if (
      body.currentStatus !== undefined &&
      body.currentStatus !== existing.currentStatus
    ) {
      cleanBody.$push = {
        statusHistory: {
          _id: new mongoose.Types.ObjectId(),
          from: existing.currentStatus || 'new',
          to: body.currentStatus,
          changedAt: new Date(),
          changedBy: body.changedBy || 'admin',
          note: body.statusNote || 'Status updated from admin panel',
        },
      };
    }
 console.log('[lead PUT] cleanBody:', JSON.stringify(cleanBody));
    const lead = await Lead.findByIdAndUpdate(id, cleanBody, {
      returnDocument: 'after',
      runValidators: true,
      context: 'query',
    })
      .populate('matchedProperties', 'propertyId title city area price configuration imageUrl status')
      .populate('interested', 'propertyId title city area price configuration imageUrl status')
      .populate('ownedPropertyDraft', 'propertyId title city area price configuration imageUrl status images');
      console.log('[lead PUT] saved assignedTo:', lead?.assignedTo);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
if (
  body.assignedTo !== undefined &&
  body.assignedTo !== existing.assignedTo
) {
  try {
    const SiteVisit = (await import('@/lib/models/SiteVisit')).default;
    await SiteVisit.updateMany(
      { lead: id },
      { $set: { channelPartnerName: body.assignedTo || '' } }
    );
    console.log(`[lead PUT] propagated "${body.assignedTo}" to site visits`);
  } catch (err) {
    console.error('[lead PUT] propagation failed:', err);
  }
}    // Detect what changed for a richer description
const changes = {};
if (body.name !== undefined && body.name !== existing.name) {
  changes.name = { from: existing.name, to: body.name };
}
if (body.currentStatus !== undefined && body.currentStatus !== existing.currentStatus) {
  changes.status = { from: existing.currentStatus || 'new', to: body.currentStatus };
}
if (body.assignedTo !== undefined && body.assignedTo !== existing.assignedTo) {
  changes.assignedTo = { from: existing.assignedTo || '', to: body.assignedTo };
}

// Only log meaningful updates
if (Object.keys(changes).length > 0) {
  let description = `Lead updated: ${lead.name || lead.phone}`;
  if (changes.assignedTo) {
    description = `Lead assigned: ${lead.name || lead.phone} → ${changes.assignedTo.to || 'Unassigned'}`;
  } else if (changes.status) {
    description = `Lead status changed: ${lead.name || lead.phone} → ${changes.status.to}`;
  }

  await logActivity(request, {
    action: changes.assignedTo ? 'lead.assigned' : 'lead.updated',
    category: 'lead',
    description,
    targetType: 'Lead',
    targetId: lead._id,
    targetLabel: lead.name || lead.phone,
    changes,
    severity: 'info',
  });
}

    return NextResponse.json({
      success: true,
      data: transformLead(lead),
      message: 'Lead updated successfully',
    });
  
  } catch (error) {
    console.error('Error updating lead:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update lead', message: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove one lead. NO body parsing.
// ---------------------------------------------------------------------------
export async function DELETE(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }
  

    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
   await logActivity(request, {
  action: 'lead.deleted',
  category: 'lead',
  description: `Lead deleted: ${lead.name || lead.phone}`,
  targetType: 'Lead',
  targetId: lead._id,
  targetLabel: lead.name || lead.phone,
  severity: 'danger',
});

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
      deletedLead: { id: lead._id, name: lead.name, phone: lead.phone },
    });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead', message: error.message }, { status: 500 });
  }
}