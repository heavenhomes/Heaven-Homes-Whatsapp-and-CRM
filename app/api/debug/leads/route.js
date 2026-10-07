import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // Block in production unless authorized
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && (!expected || authHeader !== `Bearer ${expected}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const [totalLeads, withPhone, withPhoneNumber, stepCountsAgg, sample] = await Promise.all([
      Lead.countDocuments({}),
      Lead.countDocuments({ phone: { $exists: true, $nin: [null, ''] } }),
      Lead.countDocuments({ phoneNumber: { $exists: true, $nin: [null, ''] } }),
      Lead.aggregate([{ $group: { _id: '$step', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Lead.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name phone phoneNumber step city propertyType budgetRange createdAt'),
    ]);

    const stepCounts = Object.fromEntries(stepCountsAgg.map((s) => [s._id || 'unknown', s.count]));

    return NextResponse.json({ totalLeads, withPhone, withPhoneNumber, stepCounts, sample });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}