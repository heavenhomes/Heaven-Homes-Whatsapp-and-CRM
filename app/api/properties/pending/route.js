// app/api/properties/pending/route.js
import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Property from '@/lib/models/Property';
import TeamMember from '@/lib/models/TeamMember'; // ensure model is registered
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const query = { status: 'pending' };

    const [properties, total] = await Promise.all([
      Property.find(query)
        .populate('uploadedBy', 'name username role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Property.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: properties,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending properties', message: error.message },
      { status: 500 }
    );
  }
}