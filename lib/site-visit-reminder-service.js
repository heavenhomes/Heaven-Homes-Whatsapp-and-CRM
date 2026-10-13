import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import SiteVisit from '@/lib/models/SiteVisit';
import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

const REMINDER_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
const INDIA_TIME_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getVisitDateTime(visit) {
  const date = new Date(visit.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;

  const timeMatch = String(visit.scheduledTime || '').match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );
  if (!timeMatch && !visit.scheduledTime && date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return null;
  }

  let hour = timeMatch ? Number(timeMatch[1]) : date.getUTCHours();
  const minute = timeMatch ? Number(timeMatch[2] || 0) : date.getUTCMinutes();
  const meridiem = timeMatch?.[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour === 0)) {
    return null;
  }
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const localWallClock = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute
  );
  return new Date(localWallClock - INDIA_TIME_OFFSET_MS);
}

function formatVisitTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

async function sendReminderButtons(to, text, visitId) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[site-visit-reminder] Missing WhatsApp env vars');
    return false;
  }

  const buttons = ['confirm', 'reschedule', 'cancel'].map((action) => ({
    type: 'reply',
    reply: {
      id: `site_visit_${action}::${visitId}`,
      title: {
        confirm: '✅ Confirm',
        reschedule: '🔄 Reschedule',
        cancel: '❌ Cancel',
      }[action],
    },
  }));

  try {
    const response = await axios.post(
      graphMessagesUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: { buttons },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(
      '[site-visit-reminder] WhatsApp send failed:',
      error.response?.data?.error?.message || error.message
    );
    return false;
  }
}

function getReminderText(lead, visit, scheduledAt) {
  const customerName = lead.name?.trim() || 'there';
  const visitDate = scheduledAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const visitTime = formatVisitTime(scheduledAt);

  return `Site Visit Reminder\n\nHello ${customerName}! 😊 This is a friendly reminder about your scheduled property site visit. 🏡\n\n🏡 Property: ${visit.propertyTitle}\n📅 Date: ${visitDate}\n⏰ Time: ${visitTime}\n\nPlease confirm your availability by selecting one of the options below.`;
}

export async function checkAndSendSiteVisitReminders() {
  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) return { success: false, error: 'DB unavailable', sent: 0, total: 0 };
  }

  const now = new Date();
  const visits = await SiteVisit.find({
    status: { $in: ['scheduled', 'pending', 'rescheduled'] },
    scheduledDate: {
      $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      $lte: new Date(now.getTime() + 26 * 60 * 60 * 1000),
    },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }],
  })
    .sort({ scheduledDate: 1 })
    .limit(500)
    .lean();

  const results = [];
  for (const visit of visits) {
    const scheduledAt = getVisitDateTime(visit);
    if (!scheduledAt) continue;

    const reminderAt = scheduledAt.getTime() - REMINDER_LEAD_TIME_MS;
    if (now.getTime() < reminderAt || now.getTime() >= scheduledAt.getTime()) {
      continue;
    }

    const lead = await Lead.findById(visit.lead)
      .select('name phone lastInboundMessageAt')
      .lean();
    const inboundAt = lead?.lastInboundMessageAt
      ? new Date(lead.lastInboundMessageAt).getTime()
      : 0;
    if (
      !lead?.phone ||
      !inboundAt ||
      inboundAt > now.getTime() ||
      now.getTime() - inboundAt >= WHATSAPP_WINDOW_MS
    ) {
      results.push({ success: false, visitId: visit._id.toString(), skipped: 'whatsapp_window_closed' });
      continue;
    }

    const claimed = await SiteVisit.findOneAndUpdate(
      {
        _id: visit._id,
        status: { $in: ['scheduled', 'pending', 'rescheduled'] },
        $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }],
      },
      { $set: { reminderSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;

    const sent = await sendReminderButtons(
      lead.phone,
      getReminderText(lead, visit, scheduledAt),
      visit._id.toString()
    );

    if (!sent) {
      await SiteVisit.updateOne(
        { _id: visit._id, reminderSentAt: now },
        { $unset: { reminderSentAt: 1 } }
      );
      results.push({ success: false, visitId: visit._id.toString(), error: 'send_failed' });
      continue;
    }

    await Lead.updateOne(
      { _id: lead._id },
      {
        $push: {
          conversation: {
            $each: [{
              direction: 'out',
              type: 'interactive',
              text: getReminderText(lead, visit, scheduledAt),
              payload: {
                siteVisitId: visit._id,
                options: [
                  { id: `site_visit_confirm::${visit._id}`, title: '✅ Confirm' },
                  { id: `site_visit_reschedule::${visit._id}`, title: '🔄 Reschedule' },
                  { id: `site_visit_cancel::${visit._id}`, title: '❌ Cancel' },
                ],
              },
              at: now,
            }],
            $slice: -500,
          },
        },
      }
    );
    results.push({ success: true, visitId: visit._id.toString() });
  }

  return {
    success: true,
    total: visits.length,
    sent: results.filter((result) => result.success).length,
    results,
  };
}

export async function markPastSiteVisitsPending() {
  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) return { success: false, error: 'DB unavailable', updated: 0, total: 0 };
  }

  const now = new Date();
  const visits = await SiteVisit.find({
    status: { $in: ['scheduled', 'rescheduled'] },
    scheduledDate: { $lte: now },
  })
    .select('_id scheduledDate scheduledTime')
    .sort({ scheduledDate: 1 })
    .lean();

  let updated = 0;
  for (const visit of visits) {
    const scheduledAt = getVisitDateTime(visit);
    if (!scheduledAt || scheduledAt >= now) continue;

    const result = await SiteVisit.updateOne(
      { _id: visit._id, status: { $in: ['scheduled', 'rescheduled'] } },
      { $set: { status: 'pending' } }
    );
    updated += result.modifiedCount;
  }

  return { success: true, total: visits.length, updated };
}
