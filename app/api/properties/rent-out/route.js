import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Property from '@/lib/models/Property';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;
    const status = searchParams.get('status') || 'pending'; // pending | available | rented | all
    const city = searchParams.get('city');

    const query = { source: 'whatsapp_bot' };
    if (status !== 'all') query.status = status;
    if (city) query.city = { $regex: escapeRegex(city), $options: 'i' };

    const [properties, total] = await Promise.all([
      Property.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Property.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: properties,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching rent-out listings:', error);
    return NextResponse.json({ error: 'Failed to fetch rent-out listings', message: error.message }, { status: 500 });
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}