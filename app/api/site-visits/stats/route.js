import dbConnect, { isDbConnected } from '@/lib/mongodb';
import SiteVisit from '@/lib/models/SiteVisit';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

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

    // Channel partners only see their own visits — every count is scoped
    const scope = {};
    if (!isOwner && session?.name) {
      scope.channelPartnerName = session.name;
    }

    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [
      total,
      todayCount,
      pendingCount,
      completedCount,
      scheduledCount,
      rescheduledCount,
      cancelledCount,
    ] = await Promise.all([
      SiteVisit.countDocuments({ ...scope }),
      SiteVisit.countDocuments({
        ...scope,
        scheduledDate: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ['cancelled'] },
      }),
      SiteVisit.countDocuments({ ...scope, status: { $in: ['pending', 'scheduled'] } }),
      SiteVisit.countDocuments({ ...scope, status: 'completed' }),
      SiteVisit.countDocuments({ ...scope, status: 'scheduled' }),
      SiteVisit.countDocuments({ ...scope, status: 'rescheduled' }),
      SiteVisit.countDocuments({ ...scope, status: 'cancelled' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        today: todayCount,
        pending: pendingCount,
        completed: completedCount,
        scheduled: scheduledCount,
        rescheduled: rescheduledCount,
        cancelled: cancelledCount,
      },
    });
  } catch (error) {
    console.error('[site-visits/stats] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}