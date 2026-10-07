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

    const lead = await Lead.findById(id).select('conversation').lean();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const sorted = [...(lead.conversation || [])].sort(
      (a, b) => new Date(a.at || 0) - new Date(b.at || 0)
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (error) {
    console.error('[leads/conversation] error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation', message: error.message }, { status: 500 });
  }
}