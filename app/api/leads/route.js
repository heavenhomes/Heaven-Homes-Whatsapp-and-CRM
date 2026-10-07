import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import { logActivity } from '@/lib/activity/log';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
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
  'source',
  'currentStatus',
  'assignedTo',
  'notes',
];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const currentStatus = searchParams.get('currentStatus');
    const leadType = searchParams.get('leadType');
    const city = searchParams.get('city');
    const propertyType = searchParams.get('propertyType');

    // ---- Determine caller role ----
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    const isOwner = session?.role === 'owner';

    const query = {};

    // Channel partners only see leads assigned to them
    if (!isOwner && session?.name) {
      query.assignedTo = session.name;
    }

    if (status === 'completed') query.step = 'completed';
    else if (status === 'active') query.step = { $ne: 'completed' };
    if (currentStatus) query.currentStatus = currentStatus;  
    if (leadType) query.leadType = leadType;
    if (city) query.city = { $regex: escapeRegex(city), $options: 'i' };
    if (propertyType) query.propertyType = { $regex: escapeRegex(propertyType), $options: 'i' };

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('matchedProperties', 'propertyId title city area price configuration imageUrl status')
        .populate('interested', 'propertyId title city area price configuration imageUrl status')
        .populate('ownedPropertyDraft', 'propertyId title city area price configuration imageUrl status images'),
      Lead.countDocuments(query),
    ]);

    const transformedLeads = leads.map((lead) => ({
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
      source: lead.source || 'whatsapp_bot',
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
    }));

    return NextResponse.json({
      success: true,
      data: transformedLeads,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error in GET /api/leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads', message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const body = await request.json();
    if (!body.phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleanBody = {};
    for (const key of ALLOWED_LEAD_FIELDS) {
      if (body[key] !== undefined) cleanBody[key] = body[key];
    }

    const lead = await Lead.findOneAndUpdate(
      { phone: body.phone },
      { $set: cleanBody, $setOnInsert: { phone: body.phone } },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const isNew = lead.createdAt.getTime() === lead.updatedAt.getTime();
    if (isNew) {
      await logActivity(request, {
        action: 'lead.created',
        category: 'lead',
        description: `New lead from WhatsApp: ${lead.name || lead.phone}`,
        targetType: 'Lead',
        targetId: lead._id,
        targetLabel: lead.name || lead.phone,
        severity: 'success',
        changes: { phone: lead.phone, source: 'whatsapp_bot' },
      });
    }

    return NextResponse.json(
      { success: true, data: lead, message: isNew ? 'Lead created successfully' : 'Lead updated successfully' },
      { status: isNew ? 201 : 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/leads:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create lead', message: error.message }, { status: 500 });
  }
}