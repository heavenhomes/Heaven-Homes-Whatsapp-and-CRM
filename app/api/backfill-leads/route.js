import dbConnect from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { NextResponse } from 'next/server';

export async function POST(request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();

  const result = await Lead.updateMany(
    { currentStatus: { $exists: false } },
    {
      $set: {
        currentStatus: 'new',
        assignedTo: '',
        enquiries: [],
        interestHistory: [],
        statusHistory: [],
        conversation: [],
      },
    }
  );

  // Auto-mark completed leads as 'converted' or 'active'
  await Lead.updateMany(
    { step: 'completed', currentStatus: 'new' },
    { $set: { currentStatus: 'converted' } }
  );

  await Lead.updateMany(
    { step: { $ne: 'completed' }, currentStatus: 'new' },
    { $set: { currentStatus: 'active' } }
  );

  return NextResponse.json({ success: true, modified: result.modifiedCount });
}