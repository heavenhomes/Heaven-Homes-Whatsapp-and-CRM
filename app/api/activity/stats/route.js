import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Activity from '@/lib/models/Activity';
import { NextResponse } from 'next/server';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const todayStart = startOfDay();

    const [total, today, leadEvents, propertyEvents, teamEvents] = await Promise.all([
      Activity.countDocuments({}),
      Activity.countDocuments({ createdAt: { $gte: todayStart } }),
      Activity.countDocuments({ category: 'lead' }),
      Activity.countDocuments({ category: 'property' }),
      Activity.countDocuments({ category: 'team' }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, today, leadEvents, propertyEvents, teamEvents },
    });
  } catch (error) {
    console.error('[activity/stats] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}