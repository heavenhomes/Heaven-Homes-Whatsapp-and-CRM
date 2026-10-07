import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
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

    const lead = await Lead.findById(id).select('enquiries').lean();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const enquiries = Array.isArray(lead.enquiries) ? lead.enquiries : [];
    const sorted = [...enquiries].sort(
      (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (error) {
    console.error('[leads/enquiries] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enquiries', message: error.message },
      { status: 500 }
    );
  }
}