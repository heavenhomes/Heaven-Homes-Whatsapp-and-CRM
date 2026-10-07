import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property'; // register model for populate
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

    const lead = await Lead.findById(id)
      .select('interestHistory')
      .populate({
        path: 'interestHistory.property',
        select: 'propertyId title internalName city area price configuration imageUrl status',
        strictPopulate: false,
      })
      .lean();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const history = Array.isArray(lead.interestHistory) ? lead.interestHistory : [];
    const sorted = [...history].sort(
      (a, b) => new Date(b.expressedAt || 0) - new Date(a.expressedAt || 0)
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (error) {
    console.error('[leads/interests] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interests', message: error.message },
      { status: 500 }
    );
  }
}