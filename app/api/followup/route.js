import { NextResponse } from 'next/server';
import {
  checkAndSendFollowUps,
  getFollowUpStatus,
  sendFollowUpToLead,
} from '@/lib/followup-service';

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return authHeader === `Bearer ${expected}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, phone } = await request.json();

    if (action === 'check_and_followup') {
      const result = await checkAndSendFollowUps();
      return NextResponse.json({ success: true, message: 'Follow-ups processed', ...result });
    }

    if (action === 'send_to_single_lead' && phone) {
      const result = await sendFollowUpToLead(phone);
      return NextResponse.json({ success: true, message: 'Follow-up sent', result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Follow-up error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getFollowUpStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching follow-up status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}