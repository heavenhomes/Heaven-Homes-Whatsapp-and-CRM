import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import SiteVisit from '@/lib/models/SiteVisit';
import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

export const FOLLOWUP_CONFIG = {
  delayHours: parseInt(process.env.FOLLOWUP_DELAY_HOURS || '5', 10),
  maxAttempts: parseInt(process.env.FOLLOWUP_MAX_ATTEMPTS || '3', 10),
  enabled: process.env.FOLLOWUP_ENABLED === 'true',
  batchSize: parseInt(process.env.FOLLOWUP_BATCH_SIZE || '50', 10),
};

const SITE_VISIT_FOLLOW_UP_STATUSES = ['scheduled', 'pending', 'completed', 'rescheduled'];

async function sendInteractiveButtons(to, text, buttons) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[followup] Missing WhatsApp env vars');
    return false;
  }
  const buttonObjects = buttons.slice(0, 3).map((b) => ({
    type: 'reply',
    reply: { id: b.id, title: b.title.substring(0, 20) },
  }));

  try {
    const res = await axios.post(
      graphMessagesUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: text.substring(0, 1024) },
          action: { buttons: buttonObjects },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.status >= 200 && res.status < 300;
  } catch (error) {
    const detail = error.response?.data?.error?.message || error.message;
    console.error('Error sending follow-up buttons:', detail);
    return false;
  }
}

function getIncompleteInquiryMessage(lead) {
  const lang = lead.preferredLanguage || 'en';
  const name = lead.name?.trim() || (lang === 'hi' ? 'मित्र' : lang === 'gu' ? 'મિત્ર' : 'there');
  const messages = {
    en: {
      text: `Hi ${name}! 👋\nYou haven't completed your property inquiry yet.\nWe're here to help you find the right property based on your preferences. You can continue from where you left off, return to the main menu, or stop receiving follow-ups if you've changed your mind.\nPlease choose an option below.`,
      buttons: [
        { id: 'fu_continue', title: '▶️ Continue Inquiry' },
        { id: 'main_menu', title: '📋 Main Menu' },
        { id: 'fu_stop', title: '🛑 Stop Follow-Ups' },
      ],
    },
    hi: {
      text: `नमस्ते ${name}! 👋\nआपने अभी तक अपनी प्रॉपर्टी की पूछताछ पूरी नहीं की है।\nहम आपकी पसंद के अनुसार सही प्रॉपर्टी ढूँढने में आपकी मदद करने के लिए यहाँ हैं। आप अपनी पूछताछ वहीं से जारी रख सकते हैं जहाँ आपने छोड़ी थी, मुख्य मेनू पर जा सकते हैं या आगे के रिमाइंडर बंद कर सकते हैं।\nकृपया नीचे दिए गए विकल्पों में से चुनें।`,
      buttons: [
        { id: 'fu_continue', title: '▶️ पूछताछ जारी रखें' },
        { id: 'main_menu', title: '📋 मुख्य मेनू' },
        { id: 'fu_stop', title: '🛑 रिमाइंडर बंद करें' },
      ],
    },
    gu: {
      text: `નમસ્તે ${name}! 👋\nતમે હજી સુધી તમારી પ્રોપર્ટીની પૂછપરછ પૂર્ણ કરી નથી.\nતમારી પસંદગી મુજબ યોગ્ય પ્રોપર્ટી શોધવામાં મદદ કરવા માટે અમે અહીં છીએ. તમે જ્યાં પૂછપરછ છોડી હતી ત્યાંથી ચાલુ રાખી શકો છો, મુખ્ય મેનૂ પર જઈ શકો છો અથવા આગળના રિમાઇન્ડર્સ બંધ કરી શકો છો.\nકૃપા કરીને નીચે આપેલા વિકલ્પોમાંથી એક પસંદ કરો.`,
      buttons: [
        { id: 'fu_continue', title: '▶️ પૂછપરછ ચાલુ રાખો' },
        { id: 'main_menu', title: '📋 મુખ્ય મેનૂ' },
        { id: 'fu_stop', title: '🛑 રિમાઇન્ડર્સ બંધ કરો' },
      ],
    },
  };

  return messages[lang] || messages.en;
}

function getSiteVisitFollowUpMessage(lead) {
  const lang = lead.preferredLanguage || 'en';
  const name = lead.name?.trim() || (lang === 'hi' ? 'मित्र' : lang === 'gu' ? 'મિત્ર' : 'there');
  const messages = {
    en: {
      text: `Hey ${name}! 👋\nWe've found some great property options that match your budget! 🏡\nExplore them now and find the perfect property for you. We're here to help you every step of the way!\nChoose an option below:`,
      buttons: [
        { id: 'fu_show_properties', title: 'Show Properties' },
        { id: 'fu_restart', title: 'Restart Inquiry' },
        { id: 'fu_stop', title: 'Stop Follow-Ups' },
      ],
    },
    hi: {
      text: `नमस्ते ${name}! 👋\nहमने आपके बजट के अनुसार कुछ बेहतरीन प्रॉपर्टी विकल्प ढूँढे हैं! 🏡\nअभी देखें और अपने लिए सही प्रॉपर्टी चुनें। हम आपकी मदद के लिए हमेशा तैयार हैं!\nनीचे दिए गए विकल्पों में से चुनें:`,
      buttons: [
        { id: 'fu_show_properties', title: 'प्रॉपर्टी देखें' },
        { id: 'fu_restart', title: 'नई पूछताछ शुरू करें' },
        { id: 'fu_stop', title: 'रिमाइंडर बंद करें' },
      ],
    },
    gu: {
      text: `નમસ્તે ${name}! 👋\nઅમે તમારા બજેટ મુજબ કેટલીક શાનદાર પ્રોપર્ટીના વિકલ્પો શોધ્યા છે! 🏡\nહમણાં જ જુઓ અને તમારા માટે યોગ્ય પ્રોપર્ટી પસંદ કરો. અમે તમારી મદદ માટે હંમેશા તૈયાર છીએ!\nનીચે આપેલા વિકલ્પોમાંથી પસંદ કરો:`,
      buttons: [
        { id: 'fu_show_properties', title: 'પ્રોપર્ટી જુઓ' },
        { id: 'fu_restart', title: 'નવી પૂછપરછ શરૂ કરો' },
        { id: 'fu_stop', title: 'રિમાઇન્ડર્સ બંધ કરો' },
      ],
    },
  };

  return messages[lang] || messages.en;
}

async function sendFollowUp(lead, hasSiteVisitFollowUp) {
  if (lead.followUpStatus === 'unsubscribed') {
    return { success: false, phone: lead.phone, skipped: 'unsubscribed' };
  }
  if (lead.followUpCount >= FOLLOWUP_CONFIG.maxAttempts) {
    return { success: false, phone: lead.phone, skipped: 'max_attempts' };
  }
  if (!lead.phone) {
    return { success: false, phone: lead.phone, skipped: 'no_phone' };
  }

  const message = hasSiteVisitFollowUp || lead.currentStatus === 'site_visit_completed'
    ? getSiteVisitFollowUpMessage(lead)
    : getIncompleteInquiryMessage(lead);
  const sentAt = new Date();
  const previousLastFollowUp = lead.lastFollowUp;
  const claimedLead = await Lead.findOneAndUpdate(
    {
      _id: lead._id,
      followUpCount: { $lt: FOLLOWUP_CONFIG.maxAttempts },
      followUpStatus: { $nin: ['unsubscribed', 'converted'] },
      $or: [
        { lastFollowUp: { $exists: false } },
        { lastFollowUp: null },
        { lastFollowUp: { $lte: getDelayThreshold(sentAt) } },
      ],
    },
    { $set: { lastFollowUp: sentAt } },
    { new: true }
  );

  if (!claimedLead) {
    return { success: false, phone: lead.phone, skipped: 'cooldown' };
  }

  let sent;
  try {
    sent = await sendInteractiveButtons(lead.phone, message.text, message.buttons);
  } catch (error) {
    await Lead.updateOne(
      { _id: lead._id, lastFollowUp: sentAt },
      previousLastFollowUp
        ? { $set: { lastFollowUp: previousLastFollowUp } }
        : { $unset: { lastFollowUp: 1 } }
    );
    throw error;
  }

  if (sent) {
    const updated = await Lead.updateOne(
      { _id: lead._id, lastFollowUp: sentAt },
      {
        $inc: { followUpCount: 1 },
        $set: { followUpStatus: 'sent', stuckAtStep: lead.step },
      }
    );
    if (updated.matchedCount !== 1) {
      console.error(`[followup] Could not record sent follow-up for ${lead.phone}`);
      return { success: false, phone: lead.phone, error: 'send_record_update_failed' };
    }
    console.log(`✅ Follow-up sent to ${lead.phone} (Step: ${lead.step})`);
    return { success: true, phone: lead.phone };
  }

  await Lead.updateOne(
    { _id: lead._id, lastFollowUp: sentAt },
    previousLastFollowUp
      ? { $set: { lastFollowUp: previousLastFollowUp } }
      : { $unset: { lastFollowUp: 1 } }
  );
  console.log(`❌ Failed to send follow-up to ${lead.phone}`);
  return { success: false, phone: lead.phone };
}

function getDelayThreshold(now = new Date()) {
  const delayMs = FOLLOWUP_CONFIG.delayHours * 60 * 60 * 1000;
  return new Date(now.getTime() - delayMs);
}

function getFollowUpQuery(delayThreshold, siteVisitLeadIds = []) {
  const followUpStates = [
    { currentStatus: 'site_visit_completed' },
    { step: { $ne: 'completed' }, currentStatus: { $ne: 'site_visit_completed' } },
  ];
  if (siteVisitLeadIds.length) {
    followUpStates.push({ _id: { $in: siteVisitLeadIds } });
  }

  return {
    $or: followUpStates,
    phone: { $exists: true, $nin: [null, ''] },
    followUpCount: { $lt: FOLLOWUP_CONFIG.maxAttempts },
    followUpStatus: { $nin: ['unsubscribed', 'converted'] },
    lastActivityAt: { $lte: delayThreshold },
    $and: [{
      $or: [
        { lastFollowUp: { $exists: false } },
        { lastFollowUp: null },
        { lastFollowUp: { $lte: delayThreshold } },
      ],
    }],
  };
}

export async function checkAndSendFollowUps() {
  if (!FOLLOWUP_CONFIG.enabled) {
    console.log('⚠️ Follow-ups are disabled (FOLLOWUP_ENABLED=false)');
    return { success: true, skipped: true, reason: 'disabled', sent: 0, total: 0 };
  }

  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) {
      return { success: false, error: 'DB unavailable', sent: 0, total: 0 };
    }
  }

  console.log('🔍 Checking for leads needing follow-up...');
  const delayThreshold = getDelayThreshold();
  console.log(`⏰ Delay: ${FOLLOWUP_CONFIG.delayHours}h, Threshold: ${delayThreshold.toISOString()}`);

  const siteVisitLeadIds = await SiteVisit.distinct('lead', {
    status: { $in: SITE_VISIT_FOLLOW_UP_STATUSES },
  });
  const siteVisitLeadIdSet = new Set(siteVisitLeadIds.map((id) => id.toString()));
  const leads = await Lead.find(
    getFollowUpQuery(delayThreshold, siteVisitLeadIds)
  ).limit(FOLLOWUP_CONFIG.batchSize);
  console.log(`📊 Found ${leads.length} leads needing follow-up`);

  const results = [];
  for (const lead of leads) {
    results.push(
      await sendFollowUp(lead, siteVisitLeadIdSet.has(lead._id.toString()))
    );
  }

  const sent = results.filter((r) => r.success).length;
  console.log(`✅ Follow-up check complete (${sent}/${leads.length} sent)`);

  return { success: true, total: leads.length, sent, results };
}

export async function sendFollowUpToLead(phone) {
  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) throw new Error('DB unavailable');
  }
  const lead = await Lead.findOne({ phone });
  if (!lead) throw new Error('Lead not found');
  const hasSiteVisitFollowUp =
    lead.currentStatus === 'site_visit_completed' ||
    Boolean(await SiteVisit.exists({
      lead: lead._id,
      status: { $in: SITE_VISIT_FOLLOW_UP_STATUSES },
    }));
  return sendFollowUp(lead, hasSiteVisitFollowUp);
}

export async function getFollowUpStatus() {
  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) throw new Error('DB unavailable');
  }

  const delayThreshold = getDelayThreshold();
  const siteVisitLeadIds = await SiteVisit.distinct('lead', {
    status: { $in: SITE_VISIT_FOLLOW_UP_STATUSES },
  });
  const needsFollowUp = await Lead.countDocuments(
    getFollowUpQuery(delayThreshold, siteVisitLeadIds)
  );

  const recentFollowUps = await Lead.find({ lastFollowUp: { $exists: true, $ne: null } })
    .sort({ lastFollowUp: -1 })
    .limit(10)
    .select('phone name step followUpCount lastFollowUp followUpStatus');

  return {
    config: FOLLOWUP_CONFIG,
    needsFollowUp,
    recentFollowUps,
    totalLeads: await Lead.countDocuments({}),
  };
}