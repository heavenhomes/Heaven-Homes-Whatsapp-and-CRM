import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

// Build an array of the last N month buckets, oldest → newest,
// e.g. [{ key: '2026-04', label: 'Apr' }, ..., { key: '2026-09', label: 'Sep' }]
function buildMonthBuckets(months) {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const monthIdx = d.getMonth(); // 0-11
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    buckets.push({
      key,
      label,
      start: new Date(year, monthIdx, 1),
      end: new Date(year, monthIdx + 1, 1),
    });
  }
  return buckets;
}

export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const months = Math.min(
      24,
      Math.max(1, parseInt(searchParams.get('months') || '6', 10))
    );

    // ---- Determine caller role ----
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    const isOwner = session?.role === 'owner';

    // Channel partners see only their own leads
    const baseMatch = {};
    if (!isOwner && session?.name) {
      baseMatch.assignedTo = session.name;
    }

    const buckets = buildMonthBuckets(months);
    const earliest = buckets[0].start;

    // ---- Aggregation: all leads created per month (scoped) ----
    const leadsAgg = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          createdAt: { $gte: earliest },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // ---- Aggregation: converted leads per month (scoped) ----
    // A lead counts as "converted" if its currentStatus is 'converted'.
    // We bucket by createdAt (the month the lead entered the pipeline) so
    // the two lines are directly comparable on the same x-axis.
    const conversionsAgg = await Lead.aggregate([
      {
        $match: {
          ...baseMatch,
          currentStatus: 'converted',
          createdAt: { $gte: earliest },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Index the aggregates by "YYYY-MM" key for O(1) lookup
    const leadsByMonth = {};
    for (const row of leadsAgg) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      leadsByMonth[key] = row.count;
    }

    const conversionsByMonth = {};
    for (const row of conversionsAgg) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
      conversionsByMonth[key] = row.count;
    }

    // Walk the buckets and fill in zeros where there's no data
    const labels = [];
    const leads = [];
    const conversions = [];
    for (const b of buckets) {
      labels.push(b.label);
      leads.push(leadsByMonth[b.key] || 0);
      conversions.push(conversionsByMonth[b.key] || 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        labels,
        leads,
        conversions,
        months,
        scoped: !isOwner,
      },
    });
  } catch (error) {
    console.error('[leads/history] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart history', message: error.message },
      { status: 500 }
    );
  }
}