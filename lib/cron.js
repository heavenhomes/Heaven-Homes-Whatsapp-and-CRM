import cron from 'node-cron';
import { checkAndSendFollowUps } from '@/lib/followup-service';

let cronStarted = false;

async function runFollowUpCheck(label) {
  console.log(`⏰ CRON: ${label} at ${new Date().toLocaleTimeString()}`);

  try {
    const result = await checkAndSendFollowUps();
    console.log('✅ CRON: Follow-up check complete:', result);
  } catch (error) {
    console.error('❌ CRON: Failed:', error.message);
  }
}

export function startCronJobs() {
  if (cronStarted) {
    console.log('⚠️ CRON: Already running');
    return;
  }

  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';

  console.log('🔄 CRON: Starting cron job scheduler...');
  console.log(`📋 CRON: Schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    runFollowUpCheck('Hourly follow-up triggered');
  });

  cronStarted = true;
  console.log('✅ CRON: Started successfully');

  setTimeout(() => {
    runFollowUpCheck('Initial follow-up check');
  }, 5000);
}
