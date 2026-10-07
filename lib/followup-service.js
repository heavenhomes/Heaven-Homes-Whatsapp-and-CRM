import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

export const FOLLOWUP_CONFIG = {
  delayHours: parseInt(process.env.FOLLOWUP_DELAY_HOURS || '1', 10),
  maxAttempts: parseInt(process.env.FOLLOWUP_MAX_ATTEMPTS || '3', 10),
  enabled: process.env.FOLLOWUP_ENABLED === 'true',
  batchSize: parseInt(process.env.FOLLOWUP_BATCH_SIZE || '50', 10),
};

const FOLLOWUP_BUTTONS = [
  { id: 'fu_continue', title: '📝 Continue' },
  { id: 'fu_restart', title: '🔄 Restart' },
  { id: 'fu_stop', title: '🔕 Stop' },
];

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

function getMessageForStep(step, lead) {
  const leadName = lead?.name || 'there';
  const leadCity = lead?.city || 'your preferred city';

  const messages = {
    askLanguage: {
      text: `👋 Hi! Please choose your preferred language to continue.\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askName: {
      text: `👋 Hi there! I noticed we didn't get your name yet.\n\nI'm Heaven Homes' virtual assistant, and I'd love to help you find your dream home! 🏡\n\nCould you please share your name to get started?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askPhone: {
      text: `📱 Hi ${leadName}! Please share your contact number so we can keep you updated! 📞\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askEmail: {
      text: `📧 Hi ${leadName}! Please share your email address to continue.\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askCity: {
      text: `📍 Hi ${leadName}! Which city are you looking for a property in?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askArea: {
      text: `🏘️ ${leadName}, you told me you're looking in ${leadCity}!\n\nWhich specific area or locality do you prefer?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askPropertyCategory: {
      text: `🏠 ${leadName}, how can we help you today?\n\n🏡 Buy | 🔑 Rent | 🏠 Rent Out\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askPurchaseType: {
      text: `🏢 ${leadName}, what type of property are you looking to buy?\n\n🏠 Residential | 🏢 Commercial\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askResidentialPropertyType: {
      text: `🏡 ${leadName}, what type of residential property are you looking for?\n\nApartment | House | Villa | Builder Floor | Studio | Penthouse | Farmhouse\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askCommercialPropertyType: {
      text: `🏢 ${leadName}, what type of commercial property are you looking for?\n\nOffice | Shop | Showroom | Warehouse | Industrial | Co-working\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askConfiguration: {
      text: `🔢 ${leadName}, which configuration do you prefer?\n\n1 RK | 1 BHK | 2 BHK | 3 BHK | 4 BHK | 5+ BHK | Duplex | Triplex\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askBudget: {
      text: `💰 ${leadName}, what's your preferred budget?\n\n₹10L-₹30L | ₹30L-₹60L | ₹60L-₹1Cr | Above ₹1Cr\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askPurchaseTimeline: {
      text: `📅 ${leadName}, when are you planning to buy?\n\nImmediately | 1 Month | 3 Months | Just Exploring\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askSellFirstOrBuyDirect: {
      text: `🏠 ${leadName}, are you looking to buy directly, or sell first then buy?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askRentType: {
      text: `🔑 ${leadName}, you wanted to rent!\n\nWhat type of property? 🏠 Residential | 🏢 Commercial\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askFurnishing: {
      text: `🪑 ${leadName}, what furnishing do you prefer?\n\nUnfurnished | Semi | Fully Furnished\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askRentBudget: {
      text: `💰 ${leadName}, what's your monthly rental budget?\n\nBelow ₹10K | ₹10-20K | ₹20-40K | Above ₹40K\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askMoveInTimeline: {
      text: `📅 ${leadName}, when do you plan to move in?\n\nImmediately | 15 Days | 1 Month | Just Exploring\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    showing_property: {
      text: `🏠 ${leadName}, you were looking at a property!\n\nWould you like to express interest, see another, or talk to an agent?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    askSiteVisit: {
      text: `🏡 ${leadName}, you showed interest in a property!\n\nWould you like to schedule a site visit?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    // ---- Lister (rent-out) steps ----
    listPropertyType: {
      text: `🏠 ${leadName}, let's list your property!\n\nIs it 🏠 Residential or 🏢 Commercial?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listResidentialSubType: {
      text: `🏡 ${leadName}, what type of residential property is it?\n\nApartment | House | Villa | Builder Floor | PG | Farmhouse\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listCommercialSubType: {
      text: `🏢 ${leadName}, what type of commercial property is it?\n\nOffice | Shop | Showroom | Warehouse | Co-working | Factory\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listLocation: {
      text: `📍 ${leadName}, where is your property located?\n\nPlease type City and Area (e.g., Vijay Nagar, Indore).\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listPrice: {
      text: `💰 ${leadName}, what's your expected monthly rent?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listFurnishing: {
      text: `🛋️ ${leadName}, what's the furnishing status of your property?\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listAvailability: {
      text: `📅 ${leadName}, when will your property be available?\n\nAvailable Now | Within 15 Days | Next Month\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
    listPhotos: {
      text: `📸 ${leadName}, please share 3–10 clear photos of your property to finish your listing.\n\n─────────────────────\n💬 Tap Stop to opt out of follow-ups`,
      buttons: FOLLOWUP_BUTTONS,
    },
  };

  return messages[step] || messages.askName;
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

  const stepConfig = getMessageForStep(lead.step, lead);
  const sent = await sendInteractiveButtons(lead.phone, stepConfig.text, stepConfig.buttons);

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
    step: { $nin: ['completed', 'askLanguage'] },
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