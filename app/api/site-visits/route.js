import dbConnect, { isDbConnected } from '@/lib/mongodb';
import SiteVisit from '@/lib/models/SiteVisit';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity/log';

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ---- GET /api/site-visits ----
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
    const search = searchParams.get('search');

    // ---- Determine caller role ----
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    const isOwner = session?.role === 'owner';

    const query = {};

    // Channel partners only see visits assigned to them
    if (!isOwner && session?.name) {
      query.channelPartnerName = session.name;
    }

    if (status && status !== 'all') query.status = status;

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' };
      const searchOr = [
        { leadName: re },
        { leadPhone: re },
        { propertyTitle: re },
        { propertyCode: re },
      ];
      // If we already have a channelPartnerName filter, combine with $and
      // so both apply (MongoDB treats top-level keys as AND anyway, so we
      // can just set $or alongside).
      query.$or = searchOr;
    }

    const [visits, total] = await Promise.all([
      SiteVisit.find(query)
        .sort({ scheduledDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SiteVisit.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: visits,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[site-visits] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site visits', message: error.message },
      { status: 500 }
    );
  }
}

// ---- POST /api/site-visits ----
export async function POST(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session || !['owner', 'channel_partner'].includes(session.role)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (
      !isValidObjectId(body.leadId) ||
      !isValidObjectId(body.propertyId) ||
      !body.scheduledDate ||
      typeof body.scheduledTime !== 'string' ||
      !body.scheduledTime.trim()
    ) {
      return NextResponse.json(
        { error: 'Valid leadId, propertyId, scheduledDate, and scheduledTime are required' },
        { status: 400 }
      );
    }
    const scheduledDate = new Date(body.scheduledDate);
    if (!Number.isFinite(scheduledDate.getTime()) || !body.scheduledTime) {
      return NextResponse.json({ error: 'A valid date and time are required' }, { status: 400 });
    }

    const [lead, property] = await Promise.all([
      Lead.findById(body.leadId).lean(),
      Property.findById(body.propertyId).lean(),
    ]);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    if (
      session.role === 'channel_partner' &&
      (!session.name || lead.assignedTo?.trim().toLowerCase() !== session.name.trim().toLowerCase())
    ) {
      return NextResponse.json({ error: 'You can only add visits for leads assigned to you' }, { status: 403 });
    }

    const visit = await SiteVisit.create({
      lead: lead._id,
      property: property._id,
      leadName: lead.name || '',
      leadPhone: lead.phone || '',
      propertyTitle: property.title || '',
      propertyCode: property.propertyId || '',
      scheduledDate,
      scheduledTime: body.scheduledTime,
      channelPartnerName: lead.assignedTo || '',
      status: 'scheduled',
      source: 'manual',
    });

    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        activeSiteVisit: visit._id,
        currentStatus: 'site_visit_scheduled',
        lastActivityAt: new Date(),
      },
    });

    await logActivity(request, {
      action: 'site_visit.created',
      category: 'site_visit',
      description: `Site visit scheduled: ${visit.leadName} → ${visit.propertyTitle}`,
      targetType: 'SiteVisit',
      targetId: visit._id,
      targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
      severity: 'success',
    });

    return NextResponse.json(
      { success: true, data: visit, message: 'Site visit created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[site-visits] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create site visit', message: error.message },
      { status: 500 }
    );
  }
}

export { startOfDay, endOfDay };