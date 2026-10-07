import dbConnect, { isDbConnected } from '@/lib/mongodb';
import SiteVisit from '@/lib/models/SiteVisit';
import { NextResponse } from 'next/server';

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export async function GET(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const visits = await SiteVisit.find({ lead: id })
      .populate('property', 'propertyId title city area price configuration imageUrl')
      .sort({ scheduledDate: -1 })
      .lean();

    return NextResponse.json({ success: true, data: visits });
  } catch (error) {
    console.error('[leads/site-visits] error:', error);
    return NextResponse.json({ error: 'Failed to fetch site visits', message: error.message }, { status: 500 });
  }
}