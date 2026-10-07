import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Activity from '@/lib/models/Activity';
import { NextResponse } from 'next/server';

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/activity
// Query params:
//   category = lead | property | site_visit | team | auth | all
//   search   = matches description, actorName, targetLabel
//   from     = ISO date
//   to       = ISO date
//   page, limit
export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const skip = (page - 1) * limit;

    const query = {};
    if (category && category !== 'all') query.category = category;
    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [
        { description: re },
        { actorName: re },
        { targetLabel: re },
      ];
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    const range = searchParams.get('range'); // 'today' | '7d' | '30d' | null
if (range === 'today') {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  query.createdAt = { $gte: start };
} else if (range === '7d') {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  query.createdAt = { $gte: start };
} else if (range === '30d') {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  query.createdAt = { $gte: start };
}

    const [events, total] = await Promise.all([
      Activity.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Activity.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[activity] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity', message: error.message },
      { status: 500 }
    );
  }
}