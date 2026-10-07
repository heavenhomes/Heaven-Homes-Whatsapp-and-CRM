import { NextResponse } from 'next/server';
import { checkAndSendFollowUps } from '@/lib/followup-service';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    console.log('❌ Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Cron job triggered - Starting follow-up check...');
    const result = await checkAndSendFollowUps();

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    console.log('✅ Cron job completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Follow-up cron job executed',
      result,
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
