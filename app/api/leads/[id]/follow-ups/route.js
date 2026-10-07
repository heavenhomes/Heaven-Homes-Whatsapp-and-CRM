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

    const lead = await Lead.findById(id)
      .select('followUpStatus followUpCount lastFollowUp stuckAtStep conversation')
      .lean();

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Extract follow-up messages from conversation log
    const messages = (lead.conversation || []).filter(
      (c) => c.direction === 'out' && c.payload?.stepId === 'followup'
    );

    return NextResponse.json({
      success: true,
      data: {
        status: lead.followUpStatus || 'pending',
        count: lead.followUpCount || 0,
        lastSentAt: lead.lastFollowUp || null,
        stuckAtStep: lead.stuckAtStep || null,
        messages,
      },
    });
  } catch (error) {
    console.error('[leads/follow-ups] error:', error);
    return NextResponse.json({ error: 'Failed to fetch follow-ups', message: error.message }, { status: 500 });
  }
}