import cron from 'node-cron';
import { checkAndSendFollowUps } from '@/lib/followup-service';
import { checkAndSendSiteVisitReminders } from '@/lib/site-visit-reminder-service';

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

async function runSiteVisitReminderCheck() {
  try {
    const result = await checkAndSendSiteVisitReminders();
    if (result.sent) {
      console.log('✅ CRON: Site visit reminders sent:', result.sent);
    }
  } catch (error) {
    console.error('❌ CRON: Site visit reminder check failed:', error.message);
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
  cron.schedule('* * * * *', runSiteVisitReminderCheck);

  cronStarted = true;
  console.log('✅ CRON: Started successfully');

  setTimeout(() => {
    runFollowUpCheck('Initial follow-up check');
    runSiteVisitReminderCheck();
  }, 5000);
}
