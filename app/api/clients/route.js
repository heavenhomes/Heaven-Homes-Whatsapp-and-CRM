import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { NextResponse } from 'next/server';

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments({}),
    ]);

    const clientsList = leads.map((lead) => ({
      _id: lead._id,
      name: lead.name || 'Unknown',
      phone: lead.phone || 'Unknown',
      phoneNumber: lead.phoneNumber || 'Not provided',
      email: lead.email || null,
      leadType: lead.leadType,
      city: lead.city || 'Not specified',
      area: lead.area || 'Not specified',
      propertyCategory: lead.propertyCategory || 'Not specified',
      propertyType: lead.propertyType || 'Not specified',
      budget: lead.budgetRange || 'Not specified',
      step: lead.step || 'Not started',
      createdAt: lead.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: clientsList,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}