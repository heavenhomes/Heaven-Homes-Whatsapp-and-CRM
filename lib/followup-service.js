import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

export const FOLLOWUP_CONFIG = {
  delayHours: parseInt(process.env.FOLLOWUP_DELAY_HOURS || '5', 10),
  maxAttempts: parseInt(process.env.FOLLOWUP_MAX_ATTEMPTS || '3', 10),
  enabled: process.env.FOLLOWUP_ENABLED === 'true',
  batchSize: parseInt(process.env.FOLLOWUP_BATCH_SIZE || '50', 10),
};

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
      text: `Hi ${name}! 👋\nYou haven't completed your property inquiry yet.\nWe're here to help you find the right property based on your preferences. You can continue from where you left off, restart your inquiry, or stop receiving follow-ups if you've changed your mind.\nPlease choose an option below.`,
      buttons: [
        { id: 'fu_continue', title: '▶️ Continue Inquiry' },
        { id: 'fu_restart', title: '🔄 Restart Inquiry' },
        { id: 'fu_stop', title: '🛑 Stop Inquiry' },
      ],
    },
    hi: {
      text: `नमस्ते ${name}! 👋\nआपने अभी तक अपनी प्रॉपर्टी की पूछताछ पूरी नहीं की है।\nहम आपकी पसंद के अनुसार सही प्रॉपर्टी ढूँढने में आपकी मदद करने के लिए यहाँ हैं। आप अपनी पूछताछ वहीं से दोबारा शुरू कर सकते हैं जहाँ आपने छोड़ी थी, नई पूछताछ शुरू कर सकते हैं या यदि आपका विचार बदल गया है, तो आगे के रिमाइंडर बंद कर सकते हैं।\nकृपया नीचे दिए गए विकल्पों में से चुनें।`,
      buttons: [
        { id: 'fu_continue', title: '▶️ पूछताछ जारी रखें' },
        { id: 'fu_restart', title: '🔄 नई पूछताछ शुरू करें' },
        { id: 'fu_stop', title: '🛑 पूछताछ बंद करें' },
      ],
    },
    gu: {
      text: `નમસ્તે ${name}! 👋\nતમે હજી સુધી તમારી પ્રોપર્ટીની પૂછપરછ પૂર્ણ કરી નથી.\nતમારી પસંદગી મુજબ યોગ્ય પ્રોપર્ટી શોધવામાં મદદ કરવા માટે અમે અહીં છીએ. તમે જ્યાં પૂછપરછ છોડી હતી ત્યાંથી ફરી શરૂ કરી શકો છો, નવી પૂછપરછ શરૂ કરી શકો છો અથવા જો તમારો વિચાર બદલાઈ ગયો હોય, તો આગળના રિમાઇન્ડર્સ બંધ કરી શકો છો.\nકૃપા કરીને નીચે આપેલા વિકલ્પોમાંથી એક પસંદ કરો.`,
      buttons: [
        { id: 'fu_continue', title: '▶️ पूछપરછ ચાલુ રાખો' },
        { id: 'fu_restart', title: '🔄 નવી પૂછપરછ શરૂ કરો' },
        { id: 'fu_stop', title: '🛑 पूछપરછ બંધ કરો' },
      ],
    },
  };

  return messages[lang] || messages.en;
}

async function sendFollowUp(lead) {
  if (lead.followUpStatus === 'unsubscribed') {
    return { success: false, phone: lead.phone, skipped: 'unsubscribed' };
  }
  if (lead.followUpCount >= FOLLOWUP_CONFIG.maxAttempts) {
    return { success: false, phone: lead.phone, skipped: 'max_attempts' };
  }
  if (!lead.phone) {
    return { success: false, phone: lead.phone, skipped: 'no_phone' };
  }

  const message = getIncompleteInquiryMessage(lead);
  const sent = await sendInteractiveButtons(lead.phone, message.text, message.buttons);

  if (sent) {
    lead.followUpCount = (lead.followUpCount || 0) + 1;
    lead.lastFollowUp = new Date();
    lead.followUpStatus = 'sent';
    lead.stuckAtStep = lead.step;
    await lead.save();
    console.log(`✅ Follow-up sent to ${lead.phone} (Step: ${lead.step}, Count: ${lead.followUpCount})`);
    return { success: true, phone: lead.phone };
  }

  console.log(`❌ Failed to send follow-up to ${lead.phone}`);
  return { success: false, phone: lead.phone };
}

function getDelayThreshold(now = new Date()) {
  const delayMs = FOLLOWUP_CONFIG.delayHours * 60 * 60 * 1000;
  return new Date(now.getTime() - delayMs);
}

function getFollowUpQuery(delayThreshold) {
  return {
    step: { $ne: 'completed' },
    phone: { $exists: true, $nin: [null, ''] },
    followUpCount: { $lt: FOLLOWUP_CONFIG.maxAttempts },
    followUpStatus: { $nin: ['unsubscribed', 'converted'] },
    lastActivityAt: { $lte: delayThreshold },
    $or: [
      { lastFollowUp: { $exists: false } },
      { lastFollowUp: null },
      { lastFollowUp: { $lte: delayThreshold } },
    ],
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

  const leads = await Lead.find(getFollowUpQuery(delayThreshold)).limit(FOLLOWUP_CONFIG.batchSize);
  console.log(`📊 Found ${leads.length} leads needing follow-up`);

  const results = [];
  for (const lead of leads) {
    results.push(await sendFollowUp(lead));
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
  return sendFollowUp(lead);
}

export async function getFollowUpStatus() {
  if (!isDbConnected()) {
    const conn = await dbConnect();
    if (!conn) throw new Error('DB unavailable');
  }

  const delayThreshold = getDelayThreshold();
  const needsFollowUp = await Lead.countDocuments(getFollowUpQuery(delayThreshold));

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