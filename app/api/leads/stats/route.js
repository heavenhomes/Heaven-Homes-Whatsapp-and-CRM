import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    // ---- Determine caller role ----
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    const isOwner = session?.role === 'owner';

    // Channel partners only see their own leads — every count is scoped
    const scope = {};
    if (!isOwner && session?.name) {
      scope.assignedTo = session.name;
    }

    const [
      total,
      active,
      converted,
      newCount,
      followUpCount,
      contacted,
      interested,
      svScheduled,
      svCompleted,
      lost,
      purchase,
      rent,
      rentOut,
    ] = await Promise.all([
      Lead.countDocuments({ ...scope }),
      Lead.countDocuments({
        ...scope,
        currentStatus: {
          $in: ['active', 'contacted', 'interested', 'site_visit_scheduled', 'site_visit_completed'],
        },
      }),
      Lead.countDocuments({ ...scope, currentStatus: 'converted' }),
      Lead.countDocuments({ ...scope, currentStatus: 'new' }),
      Lead.countDocuments({ ...scope, currentStatus: 'follow_up' }),
      Lead.countDocuments({ ...scope, currentStatus: 'contacted' }),
      Lead.countDocuments({ ...scope, currentStatus: 'interested' }),
      Lead.countDocuments({ ...scope, currentStatus: 'site_visit_scheduled' }),
      Lead.countDocuments({ ...scope, currentStatus: 'site_visit_completed' }),
      Lead.countDocuments({ ...scope, currentStatus: 'lost' }),
      Lead.countDocuments({ ...scope, propertyCategory: 'purchase' }),
      Lead.countDocuments({ ...scope, propertyCategory: 'rent_lease' }),
      Lead.countDocuments({ ...scope, propertyCategory: 'rent_out' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        active,
        converted,
        byStatus: {
          new: newCount,
          follow_up: followUpCount,
          active,
          contacted,
          interested,
          site_visit_scheduled: svScheduled,
          site_visit_completed: svCompleted,
          lost,
          converted,
        },
        byCategory: { purchase, rent, rentOut },
      },
    });
  } catch (error) {
    console.error('[leads/stats] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}