import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import SiteVisit from '@/lib/models/SiteVisit';
import { generateUniquePropertyId } from '@/lib/property-id';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import axios from 'axios';
import {
  touchLeadActivity,
  resetLeadProgress,
  unsubscribeLead,
  isRestartAction,
  isStopFollowUpAction,
  isContinueAction,
} from '@/lib/lead-helpers';
import { saveWhatsAppImageToCloudinary } from '@/lib/cloudinary';
import {
  getWhatsAppConfig,
  graphMessagesUrl,
} from '@/lib/whatsapp-config';
import {
  placeKey,
  toTitleCase,
  uniqueTitleCase,
  matchPlace,
} from '@/lib/place-names';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * ============================================================================
 *  HEAVEN HOMES / SHIVAY PROPERTIES — WHATSAPP WEBHOOK
 * ============================================================================
 *
 *  Duplicate-message prevention strategy:
 *   1. In-memory per-phone queue (`phoneQueues`) — serializes messages for
 *      the same phone within one instance so concurrent webhook deliveries
 *      can't race on the same Lead document; it no longer drops messages.
 *   2. Atomic DB guard on `lastIncomingMessageId` — authoritative, survives
 *      Meta retries and cross-instance concurrency.
 *
 *  CRM tracking:
 *   - conversation[]  — every inbound + outbound message
 *   - enquiries[]     — one snapshot per completed qualification run
 *   - interestHistory[] — every property the lead tapped "Interested" on
 *   - statusHistory[] — every CRM status change
 * ============================================================================
 */

const EXPERT_NAME = process.env.EXPERT_CONTACT_NAME || 'our team';
const EXPERT_PHONE =
  process.env.EXPERT_CONTACT_PHONE || '+91 8200906261 / +91 9727138080';

// ---------------------------------------------------------------------------
// 0. TRANSLATION HELPERS
// ---------------------------------------------------------------------------

function t(lang, tri) {
  return tri[lang] || tri.en;
}

const ERROR_PREFIX = {
  en: "❌ Sorry, I didn't understand that. ",
  hi: '❌ माफ़ कीजिए, मुझे यह समझ नहीं आया। ',
  gu: '❌ માફ કરશો, મને એ સમજાયું નહીં. ',
};

// ---------------------------------------------------------------------------
// 0b. CRM EVENT LOGGING HELPERS
// ---------------------------------------------------------------------------

const MAX_CONVERSATION = 500;

function pushConversation(lead, entry) {
  if (!Array.isArray(lead.conversation)) lead.conversation = [];
  if (lead.conversation.length >= MAX_CONVERSATION) {
    lead.conversation = lead.conversation.slice(-(MAX_CONVERSATION - 1));
  }
  lead.conversation.push({
    _id: new mongoose.Types.ObjectId(),
    at: new Date(),
    ...entry,
  });
  lead.markModified('conversation');
}

function pushStatusChange(lead, to, by = 'system', note = '') {
  const from = lead.currentStatus || 'new';
  if (from === to) return;

  if (!Array.isArray(lead.statusHistory)) lead.statusHistory = [];
  lead.statusHistory.push({
    _id: new mongoose.Types.ObjectId(),
    from,
    to,
    changedAt: new Date(),
    changedBy: by,
    note,
  });
  lead.currentStatus = to;
  lead.markModified('statusHistory');
}

function pushEnquiry(lead) {
  if (!Array.isArray(lead.enquiries)) lead.enquiries = [];

  const purpose =
    lead.leadType === 'lister'
      ? 'Rent Out'
      : lead.propertyCategory === 'rent_lease'
      ? 'Rent'
      : 'Buy';

  const categoryLabel =
    lead.propertyType === 'commercial' ? 'Commercial' : 'Residential';

  const subtypeLabel = lead.propertySubType
    ? lead.propertySubType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  const configLabel = lead.configuration
    ? lead.configuration.toUpperCase().replace('BHK', ' BHK').trim()
    : '';

  const sizeLabel =
    lead.spaceSize ||
    (lead.listingDraft?.areaSqft ? `${lead.listingDraft.areaSqft} sq.ft` : '');

  lead.enquiries.push({
    _id: new mongoose.Types.ObjectId(),
    submittedAt: new Date(),
    city: lead.city || '',
    area: lead.area || '',
    purpose,
    propertyCategory: categoryLabel,
    propertyType: subtypeLabel,
    configuration:
      lead.configuration === 'commercial' ? 'Commercial' : configLabel,
    size: sizeLabel,
    budgetRange: lead.budgetRange || '',
    budgetLabel: lead.rentBudgetLabel || lead.budgetRange || '',
    ...(lead.leadType === 'lister' || lead.propertyCategory === 'rent_out'
      ? { timeline: lead.timeline || '' }
      : {}),
    buyingPlan: lead.investmentType || '',
    furnishing: lead.furnishing || '',
    spaceSize: lead.spaceSize || '',
    source: 'whatsapp_bot',
  });

  lead.markModified('enquiries');
}

function pushInterest(lead, property) {
  if (!Array.isArray(lead.interestHistory)) lead.interestHistory = [];
  lead.interestHistory.push({
    _id: new mongoose.Types.ObjectId(),
    property: property._id,
    propertyCode: property.propertyId || '',
    propertyTitle: property.title || '',
    propertySnapshot: {
      city: property.city,
      area: property.area,
      price: property.price,
      configuration: property.configuration,
      imageUrl: property.imageUrl,
      images: property.images || [],
      internalName: property.internalName || '',
    },
    expressedAt: new Date(),
  });
  lead.markModified('interestHistory');
}

// ---------------------------------------------------------------------------
// 1. WHATSAPP SEND HELPERS
// ---------------------------------------------------------------------------

async function callGraphApi(body) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[webhook] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
    return false;
  }
  try {
    await axios.post(
      graphMessagesUrl(phoneNumberId),
      { messaging_product: 'whatsapp', ...body },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return true;
  } catch (error) {
    console.error(
      '[webhook] Send failed:',
      error.response?.data?.error?.message || error.message
    );
    return false;
  }
}

async function sendText(to, text) {
  return callGraphApi({
    to,
    type: 'text',
    text: { body: text.slice(0, 4096), preview_url: false },
  });
}

async function sendButtons(to, bodyText, buttons) {
  const trimmed = buttons.slice(0, 3).map((b) => ({
    type: 'reply',
    reply: { id: b.id, title: b.title.slice(0, 20) },
  }));
  return callGraphApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: { buttons: trimmed },
    },
  });
}

async function sendList(to, bodyText, buttonLabel, rows, sectionTitle = 'Options') {
  const trimmedRows = rows.slice(0, 10).map((r) => ({
    id: r.id,
    title: r.title.slice(0, 24),
    description: r.description ? r.description.slice(0, 72) : undefined,
  }));
  return callGraphApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [{ title: sectionTitle.slice(0, 24), rows: trimmedRows }],
      },
    },
  });
}

async function sendImage(to, imageUrl) {
  return callGraphApi({
    to,
    type: 'image',
    image: { link: imageUrl },
  });
}

function parseOneMessage(message) {
  const from = message.from;
  const wamid = message.id || '';

  if (message.type === 'text') {
    return { from, wamid, type: 'text', text: message.text?.body?.trim() || '' };
  }
  if (message.type === 'interactive') {
    const chosen =
      message.interactive?.button_reply || message.interactive?.list_reply;
    return {
      from,
      wamid,
      type: 'interactive',
      id: chosen?.id,
      title: chosen?.title,
    };
  }
  if (message.type === 'image') {
    return { from, wamid, type: 'image', mediaId: message.image?.id };
  }
  return { from, wamid, type: message.type || 'unsupported' };
}

function parseIncomingMessages(body) {
  const results = [];
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const metadata = change?.value?.metadata || {};
        const businessPhoneNumberId = metadata.phone_number_id || '';
        const businessDisplayPhone = metadata.display_phone_number || '';
        const messages = change?.value?.messages || [];
        for (const message of messages) {
          if (!message) continue;
          const parsed = parseOneMessage(message);
          if (parsed) {
            parsed.businessPhoneNumberId = businessPhoneNumberId;
            parsed.businessDisplayPhone = businessDisplayPhone;
            results.push(parsed);
          }
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Failed to parse payload:', err);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. SMALL DOMAIN HELPERS
// ---------------------------------------------------------------------------

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIndianCurrency(text) {
  const clean = text
    .toLowerCase()
    .replace(/₹|rs\.?|per\s*month|\/month|,/g, '')
    .trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  if (/cr/.test(clean)) return Math.round(num * 1e7);
  if (/l(akh)?/.test(clean)) return Math.round(num * 1e5);
  return Math.round(num);
}

function parseVisitDateTime(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();

  let hour = null;
  let minute = 0;

  const timeMatch =
    lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/) ||
    lower.match(/(\d{1,2})()\s*(am|pm)\b/) ||
    lower.match(/\bat\s+(\d{1,2})()()\b/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3];

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (!meridiem) {
      if (hour >= 1 && hour <= 7) hour += 12;
    }
  }
  const time =
    hour !== null
      ? `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
      : '';

  let date = null;

  const monthNames = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9,
    november: 10, nov: 10, december: 11, dec: 11,
  };
  const monthDayYear = lower.match(
    /(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})/
  );
  if (monthDayYear) {
    const day = parseInt(monthDayYear[1], 10);
    const monthKey = monthDayYear[2].toLowerCase();
    const year = parseInt(monthDayYear[3], 10);
    if (monthKey in monthNames) {
      date = new Date(year, monthNames[monthKey], day);
    }
  }

  if (!date) {
    const monthDay = lower.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]+)/);
    if (monthDay) {
      const day = parseInt(monthDay[1], 10);
      const monthKey = monthDay[2].toLowerCase();
      if (monthKey in monthNames) {
        const now = new Date();
        let year = now.getFullYear();
        const candidate = new Date(year, monthNames[monthKey], day);
        if (candidate < now) year += 1;
        date = new Date(year, monthNames[monthKey], day);
      }
    }
  }

  if (!date) {
    const dmy = lower.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10) - 1;
      let year = parseInt(dmy[3], 10);
      if (year < 100) year += 2000;
      if (day > 12) {
        date = new Date(year, month, day);
      } else if (month > 12) {
        date = new Date(year, day - 1, month + 1);
      } else {
        date = new Date(year, month, day);
      }
    }
  }

  if (!date) {
    if (/day after tomorrow/.test(lower)) {
      date = new Date(); date.setDate(date.getDate() + 2);
    } else if (/tomorrow/.test(lower)) {
      date = new Date(); date.setDate(date.getDate() + 1);
    } else if (/today|tonight/.test(lower)) {
      date = new Date();
    }
  }

  if (!date) {
    const inDays = lower.match(/in\s+(\d+)\s+days?/);
    if (inDays) {
      date = new Date();
      date.setDate(date.getDate() + parseInt(inDays[1], 10));
    }
  }

  if (!date) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayMatch = days.find((d) => lower.includes(d));
    if (dayMatch) {
      const target = days.indexOf(dayMatch);
      const now = new Date();
      const diff = (target - now.getDay() + 7) % 7 || 7;
      date = new Date();
      date.setDate(now.getDate() + diff);
    }
  }

  if (!date) {
    date = new Date();
    date.setDate(date.getDate() + 3);
  }

  if (hour !== null) {
    date.setHours(hour, minute, 0, 0);
  } else {
    date.setHours(11, 0, 0, 0);
  }

  return { date, time, raw };
}

function bucketRentAmount(amount) {
  if (amount < 10000) return 'low';
  if (amount < 20000) return 'mid';
  if (amount < 40000) return 'high';
  return 'luxury';
}

function parseCityArea(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      area: toTitleCase(parts.slice(0, -1).join(', ')),
      city: toTitleCase(parts[parts.length - 1]),
    };
  }
  const titled = toTitleCase(raw);
  return { area: titled, city: titled };
}

function defaultConfigForSubType(subType, isCommercial) {
  if (isCommercial) return 'commercial';
  if (subType === 'pg' || subType === 'studio') return '1bhk';
  if (subType === 'villa' || subType === 'farmhouse' || subType === 'penthouse')
    return '4bhk';
  return '2bhk';
}

async function createPendingRentOutListing(lead) {
  if (lead.ownedPropertyDraft) {
    return Property.findById(lead.ownedPropertyDraft);
  }

  const isCommercial = lead.purchaseType === 'commercial_rent';
  const subType = lead.propertySubType || (isCommercial ? 'office' : 'apartment');
  const configuration =
    lead.configuration || defaultConfigForSubType(subType, isCommercial);
  lead.configuration = configuration;

  const title = `${isCommercial ? subType : configuration.toUpperCase() + ' ' + subType} for Rent in ${lead.area}`;

  const propertyId = await generateUniquePropertyId(Property);

  const property = await Property.create({
    propertyId,
    title,
    city: lead.city,
    area: lead.area,
    propertyType: isCommercial ? 'commercial' : 'rent',
    propertySubType: subType,
    budgetRange: lead.budgetRange || 'mid',
    price: lead.listingDraft?.price || 0,
    configuration,
    spaceSize: lead.spaceSize || null,
    location: lead.listingDraft?.location || `${lead.area}, ${lead.city}`,
    areaSqft: lead.listingDraft?.areaSqft || 1000,
    furnishing: lead.furnishing || 'unfurnished',
    status: 'pending',
    source: 'whatsapp_bot',
    ownerPhone: lead.phone,
    ownerName: lead.name || '',
    description: lead.timeline ? `Available: ${lead.timeline}` : '',
  });

  lead.ownedPropertyDraft = property._id;
  await lead.save();

  return property;
}

let placesCanonicalized = false;

async function canonicalizeStoredPlaces() {
  if (placesCanonicalized) return;
  placesCanonicalized = true;
  try {
    if (typeof Property.canonicalizePlaces === 'function') {
      await Property.canonicalizePlaces();
      return;
    }
    const docs = await Property.find({}).select('city area').lean();
    const ops = [];
    for (const p of docs) {
      const city = toTitleCase(p.city);
      const area = toTitleCase(p.area);
      if (city !== (p.city || '') || area !== (p.area || '')) {
        ops.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { city, area } },
          },
        });
      }
    }
    if (ops.length) await Property.bulkWrite(ops, { ordered: false });
  } catch (err) {
    placesCanonicalized = false;
    console.error('[places] Failed to normalize city/area case:', err.message);
  }
}

/**
 * Formats a list of place names as separate lines, each prefixed with 📍.
 * Used for "we don't serve here yet, but we cover:" style messages.
 */
function formatPlaceListMultiline(places, opts = {}) {
  if (!Array.isArray(places) || places.length === 0) return '';
  const { limit = 25, indent = false } = opts;
  const shown = places.slice(0, limit);
  const prefix = indent ? '  ' : '';
  return shown.map((p) => `${prefix}📍${p}`).join('\n');
}

async function getAvailablePlaceRows() {
  await canonicalizeStoredPlaces();
  return Property.find({ status: 'available' }).select('city area').lean();
}

async function getAreasForCity(city) {
  const key = placeKey(city);
  if (!key) return [];
  const rows = await getAvailablePlaceRows();
  return uniqueTitleCase(
    rows.filter((r) => placeKey(r.city) === key).map((r) => r.area)
  );
}

// ---------------------------------------------------------------------------
// 3. MATCHING
// ---------------------------------------------------------------------------

const SUBTYPE_ALIASES = {
  apartment: ['apartment', 'flat'],
  flat: ['flat', 'apartment'],
  house: ['house', 'villa', 'builder_floor'],
  villa: ['villa', 'house'],
  builder_floor: ['builder_floor', 'house', 'apartment'],
  pg: ['pg', 'apartment', 'flat'],
  bunglow: ['bunglow', 'house', 'villa', 'builder_floor'],
  farmhouse: ['farmhouse', 'house', 'villa'],
  studio: ['studio', 'apartment', 'flat'],
  penthouse: ['penthouse', 'apartment'],
  shop: ['shop'],
  showroom: ['showroom', 'shop'],
  warehouse: ['warehouse', 'factory', 'industrial'],
  office: ['office', 'coworking'],
  coworking: ['coworking', 'office'],
  factory: ['factory', 'industrial', 'warehouse'],
  industrial: ['industrial', 'factory', 'warehouse'],
};

const BUDGET_RANK = ['low', 'mid', 'high', 'luxury'];

function normalizeSubType(value) {
  if (!value) return '';
  if (value === 'flat') return 'apartment';
  return value;
}

function scorePropertyMatch(property, lead) {
  let score = 0;
  const city = placeKey(lead.city);
  const area = placeKey(lead.area);
  const pCity = placeKey(property.city);
  const pArea = placeKey(property.area);

  if (city && pCity === city) score += 100;
  else if (city && (pCity.includes(city) || city.includes(pCity))) score += 35;

  if (area && pArea === area) score += 80;
  else if (area && (pArea.includes(area) || area.includes(pArea))) score += 40;

  if (lead.propertyType && property.propertyType === lead.propertyType) score += 50;

  if (lead.propertySubType) {
    const wanted = normalizeSubType(lead.propertySubType);
    const got = normalizeSubType(property.propertySubType);
    if (wanted && got === wanted) score += 45;
    else if (
      wanted &&
      (SUBTYPE_ALIASES[lead.propertySubType] || []).includes(property.propertySubType)
    ) {
      score += 22;
    }
  }

  if (lead.configuration && property.configuration === lead.configuration) score += 30;

  if (lead.budgetRange && property.budgetRange === lead.budgetRange) score += 25;
  else if (lead.budgetRange && property.budgetRange) {
    const wantedIdx = BUDGET_RANK.indexOf(lead.budgetRange);
    const gotIdx = BUDGET_RANK.indexOf(property.budgetRange);
    if (wantedIdx >= 0 && gotIdx >= 0 && Math.abs(wantedIdx - gotIdx) === 1) score += 10;
  }

  if (
    lead.propertyCategory === 'rent_lease' &&
    lead.furnishing &&
    property.furnishing === lead.furnishing
  ) {
    score += 15;
  }
  if (lead.spaceSize && property.spaceSize === lead.spaceSize) score += 15;

  return score;
}

async function findMatchingProperties(lead) {
  const cityKey = placeKey(lead.city);
  const areaKey = placeKey(lead.area);

  const typeQuery = { status: 'available' };
  if (lead.propertyType) typeQuery.propertyType = lead.propertyType;

  let properties = await Property.find(typeQuery);
  if (cityKey) {
    const inCity = properties.filter((p) => placeKey(p.city) === cityKey);
    if (inCity.length > 0) {
      properties = inCity;
    } else {
      const allAvailable = await Property.find({ status: 'available' });
      properties = allAvailable.filter((p) => placeKey(p.city) === cityKey);
    }
  }

  let usedAreaFallback = false;
  if (areaKey) {
    const inArea = properties.filter((p) => placeKey(p.area) === areaKey);
    if (inArea.length > 0) {
      properties = inArea;
    } else {
      usedAreaFallback = properties.length > 0;
    }
  }

  lead._usedAreaFallback = usedAreaFallback;

  const alreadyShownIds = new Set(
    (lead.matchedProperties || []).map((id) => id.toString())
  );
  const freshProperties =
    alreadyShownIds.size > 0
      ? properties.filter((p) => !alreadyShownIds.has(p._id.toString()))
      : properties;
  const candidatePool = freshProperties.length > 0 ? freshProperties : properties;

  const ranked = candidatePool
    .map((property) => ({ property, score: scorePropertyMatch(property, lead) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(a.property.price || 0) - Number(b.property.price || 0)
    )
    .slice(0, 10);

  lead.hadExactMatch =
    ranked.length > 0 && !lead._usedAreaFallback && ranked[0].score > 100;

  return ranked.map((row) => row.property);
}

// ---- Price / label formatting (language-aware) ----

const CR_LABEL = { en: 'Cr', hi: 'करोड़', gu: 'કરોડ' };
const LAKH_LABEL = { en: 'Lakhs', hi: 'लाख', gu: 'લાખ' };

function formatIndianPrice(amount, lang = 'en') {
  const n = Number(amount || 0);
  if (n >= 1e7) {
    const cr = n / 1e7;
    return `₹${cr.toFixed(cr % 1 === 0 ? 0 : 2).replace(/\.00$/, '')} ${t(lang, CR_LABEL)}`;
  }
  if (n >= 1e5) {
    const l = n / 1e5;
    return `₹${l.toFixed(l % 1 === 0 ? 0 : 2).replace(/\.00$/, '')} ${t(lang, LAKH_LABEL)}`;
  }
  return `₹${n.toLocaleString('en-IN')}`;
}

const SUBTYPE_LABELS = {
  apartment: { en: 'Apartment', hi: 'अपार्टमेंट', gu: 'એપાર્ટમેન્ટ' },
  house: { en: 'House', hi: 'मकान', gu: 'ઘર' },
  villa: { en: 'Villa', hi: 'विला', gu: 'વિલા' },
  bunglow: { en: 'Bungalow', hi: 'बंगला', gu: 'બંગલો' },
  builder_floor: { en: 'Builder Floor', hi: 'बिल्डर फ्लोर', gu: 'બિલ્ડર ફ્લોર' },
  plot: { en: 'Plot', hi: 'प्लॉट', gu: 'પ્લોટ' },
  office: { en: 'Office', hi: 'ऑफिस', gu: 'ઓફિસ' },
  shop: { en: 'Shop', hi: 'दुकान', gu: 'દુકાન' },
  showroom: { en: 'Showroom', hi: 'शोरूम', gu: 'શોરૂમ' },
  warehouse: { en: 'Warehouse', hi: 'गोदाम', gu: 'ગોદામ' },
};

function formatSubType(s, lang = 'en') {
  if (!s) return t(lang, { en: 'Property', hi: 'संपत्ति', gu: 'પ્રોપર્ટી' });
  const key = s.toLowerCase().trim();
  if (SUBTYPE_LABELS[key]) return t(lang, SUBTYPE_LABELS[key]);
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const BHK_LABEL = { en: 'BHK', hi: 'बीएचके', gu: 'બીએચકે' };

function formatConfiguration(c, lang = 'en') {
  if (!c) return '';
  const upper = c.toUpperCase().replace('BHK', '').trim();
  if (/^\d+\+?$/.test(upper)) {
    return `${upper} ${t(lang, BHK_LABEL)}`;
  }
  return c.toUpperCase().replace('BHK', ` ${t(lang, BHK_LABEL)}`);
}

const FACING_LABELS = {
  east: { en: 'East', hi: 'पूर्व', gu: 'પૂર્વ' },
  west: { en: 'West', hi: 'पश्चिम', gu: 'પશ્ચિમ' },
  north: { en: 'North', hi: 'उत्तर', gu: 'ઉત્તર' },
  south: { en: 'South', hi: 'दक्षिण', gu: 'દક્ષિણ' },
  'north east': { en: 'North-East', hi: 'उत्तर-पूर्व', gu: 'ઉત્તર-પૂર્વ' },
  'north west': { en: 'North-West', hi: 'उत्तर-पश्चिम', gu: 'ઉત્તર-પશ્ચિમ' },
  'south east': { en: 'South-East', hi: 'दक्षिण-पूर्व', gu: 'દક્ષિણ-પૂર્વ' },
  'south west': { en: 'South-West', hi: 'दक्षिण-पश्चिम', gu: 'દક્ષિણ-પશ્ચિમ' },
};

function formatFacing(f, lang = 'en') {
  if (!f) return '';
  const key = f.toLowerCase().replace(/[-_]/g, ' ').trim();
  if (FACING_LABELS[key]) return t(lang, FACING_LABELS[key]);
  return f;
}

const TENANT_PREF_LABELS = {
  bachelors: { en: 'Bachelors', hi: 'बैचलर', gu: 'બેચલર' },
  family: { en: 'Family', hi: 'परिवार', gu: 'પરિવાર' },
  both: { en: 'Both', hi: 'दोनों', gu: 'બંને' },
};

const FOOD_PREF_LABELS = {
  vegetarian: { en: 'Vegetarian', hi: 'शाकाहारी', gu: 'શાકાહારી' },
  non_vegetarian: { en: 'Non-Vegetarian', hi: 'मांसाहारी', gu: 'માંસાહારી' },
};

function formatPreferenceList(arr, labelMap, lang = 'en') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr
    .map((v) => (labelMap[v] ? t(lang, labelMap[v]) : v))
    .join(', ');
}

const FLOOR_LABELS = {
  ground: { en: 'Ground', hi: 'ग्राउंड', gu: 'ગ્રાઉન્ડ' },
  basement: { en: 'Basement', hi: 'बेसमेंट', gu: 'બેઝમેન્ટ' },
};

function formatFloor(fl, lang = 'en') {
  if (!fl) return '';
  const key = fl.toLowerCase().trim();
  if (FLOOR_LABELS[key]) return t(lang, FLOOR_LABELS[key]);
  return fl;
}

const CARD_LABELS = {
  propertyCode: { en: 'Property ID', hi: 'प्रॉपर्टी आईडी', gu: 'પ્રોપર્ટી આઈડી' },
  location: { en: 'Location', hi: 'स्थान', gu: 'સ્થળ' },
  propertyType: { en: 'Property Type', hi: 'संपत्ति प्रकार', gu: 'પ્રોપર્ટી પ્રકાર' },
  configuration: { en: 'Configuration', hi: 'कॉन्फ़िगरेशन', gu: 'કન્ફિગરેશન' },
  dimension: { en: 'Dimension', hi: 'आयाम', gu: 'પરિમાણ' },
  carpetArea: { en: 'Carpet Area', hi: 'कारपेट एरिया', gu: 'કારપેટ એરિયા' },
  size: { en: 'Size', hi: 'आकार', gu: 'કદ' },
  monthlyRent: { en: 'Monthly Rent', hi: 'मासिक किराया', gu: 'માસિક ભાડું' },
  securityDeposit: { en: 'Security Deposit', hi: 'सुरक्षा जमा', gu: 'સિક્યુરિટી ડિપોઝિટ' },
  price: { en: 'Price', hi: 'कीमत', gu: 'કિંમત' },
  facing: { en: 'Facing', hi: 'दिशा', gu: 'દિશા' },
  facingSuffix: { en: 'Facing', hi: 'मुखी', gu: 'મુખ' },
  floor: { en: 'Floor', hi: 'मंज़िल', gu: 'માળ' },
  floorSuffix: { en: 'Floor', hi: 'मंज़िल', gu: 'માળ' },
  availableFrom: { en: 'Available From', hi: 'उपलब्ध तिथि', gu: 'ઉપલબ્ધ તારીખ' },
  buildingStatus: { en: 'Building Status', hi: 'निर्माण स्थिति', gu: 'બિલ્ડિંગ સ્થિતિ' },
  video: { en: 'Video', hi: 'वीडियो', gu: 'વિડિયો' },
  features: { en: 'Features', hi: 'विशेषताएं', gu: 'સુવિધાઓ' },
  sqft: { en: 'Sq. Ft.', hi: 'वर्ग फुट', gu: 'ચો. ફૂટ' },
  tenantPreferences: { en: 'Tenant Preferences', hi: 'किरायेदार प्राथमिकता', gu: 'ભાડૂત પ્રાથમિકતા' },
  foodPreferences: { en: 'Food Preferences', hi: 'भोजन प्राथमिकता', gu: 'ભોજન પ્રાથમિકતા' },
};

function propertyCardCaption(property, lang = 'en') {
  const L = (key) => t(lang, CARD_LABELS[key]);
  const lines = [];
  lines.push(`🏢 *${property.title}*`);
  lines.push('');
  if (property.propertyId) lines.push(`🆔 ${L('propertyCode')} : *${property.propertyId}*`);
  const buildingStatusLabels = {
    under_construction: 'Under Construction',
    new_booking: 'New Booking',
    resale_property: 'Resale Property',
  };
  if (property.buildingStatus && buildingStatusLabels[property.buildingStatus]) {
    lines.push(`🏗️ ${L('buildingStatus')} : ${buildingStatusLabels[property.buildingStatus]}`);
  }
  if (property.videoLink) {
    lines.push(`🎥 ${L('video')} : ${property.videoLink}`);
  }
  lines.push(`📍 ${L('location')} : ${toTitleCase(property.area)}, ${toTitleCase(property.city)}`);
  lines.push(`🏠 ${L('propertyType')} : ${formatSubType(property.propertySubType, lang)}`);

  const isCommercial = property.propertyType === 'commercial';
  const isRent = property.propertyType === 'rent';

  if (property.configuration && property.configuration !== 'commercial') {
    lines.push(`🛏 ${L('configuration')} : ${formatConfiguration(property.configuration, lang)}`);
  }

  if (property.dimensions) {
    lines.push(`📐 ${L('dimension')} : ${property.dimensions}`);
  }

  if (isCommercial) {
    if (property.areaSqft) {
      lines.push(`📐 ${L('carpetArea')} : ${property.areaSqft} ${L('sqft')}`);
    }
  } else if (property.areaSqft) {
    lines.push(`📐 ${L('size')} : ${property.areaSqft} ${L('sqft')}`);
  }

  if (isRent) {
    lines.push(
      `💰 ${L('monthlyRent')} : ₹${Number(property.price || 0).toLocaleString('en-IN')}`
    );
    if (property.securityDeposit) {
      lines.push(
        `💵 ${L('securityDeposit')} : ₹${Number(property.securityDeposit).toLocaleString('en-IN')}`
      );
    }
  } else {
    lines.push(`💰 ${L('price')} : ${formatIndianPrice(property.price, lang)}`);
  }

  if (property.facing) {
    lines.push(`🧭 ${L('facing')} : ${formatFacing(property.facing, lang)} ${L('facingSuffix')}`);
  }

  if (property.floor) {
    lines.push(`🏢 ${L('floor')} : ${formatFloor(property.floor, lang)} ${L('floorSuffix')}`);
  }

  if (isRent || property.propertyType === 'commercial') {
    const tenantLabel = formatPreferenceList(
      property.tenantPreferences,
      TENANT_PREF_LABELS,
      lang
    );
    if (tenantLabel) {
      lines.push(`👥 ${L('tenantPreferences')} : ${tenantLabel}`);
    }

    const foodLabel = formatPreferenceList(
      property.foodPreferences,
      FOOD_PREF_LABELS,
      lang
    );
    if (foodLabel) {
      lines.push(`🍽️ ${L('foodPreferences')} : ${foodLabel}`);
    }
  }

  if (property.availableFrom) {
    lines.push(`📅 ${L('availableFrom')} : ${property.availableFrom}`);
  }

  if (property.features?.length) {
    lines.push('');
    lines.push(`⭐ *${L('features')}*`);
    property.features.slice(0, 12).forEach((f) => lines.push(`• ${f}`));
  }

  if (property.description) {
    lines.push('');
    lines.push(`📝 ${property.description}`);
  }

  return lines.join('\n');
}

const PROPERTY_CARD_HEADER = {
  fallback: {
    en: "🙏 Thank you for sharing your requirements.\nWe couldn't find an exact property matching all of your selected preferences at the moment.\nHowever, here's a similar property that may still be a great fit:\n\n",
    hi: '🙏 अपनी आवश्यकताएं साझा करने के लिए धन्यवाद।\nअभी हमें आपकी सभी चुनी हुई पसंदों से पूरी तरह मेल खाती संपत्ति नहीं मिली।\nलेकिन यहां एक समान संपत्ति है जो आपके लिए उपयुक्त हो सकती है:\n\n',
    gu: '🙏 તમારી જરૂરિયાતો શેર કરવા બદલ આભાર.\nહાલમાં અમને તમારી બધી પસંદગીઓ સાથે સંપૂર્ણપણે મેળ ખાતી પ્રોપર્ટી મળી નથી.\nપરંતુ અહીં એક સમાન પ્રોપર્ટી છે જે તમારા માટે યોગ્ય હોઈ શકે છે:\n\n',
  },
  match: {
    en: '🎉 *Great news!*\nWe found a property that closely matches your preferences.\nHere are the details: 👇\n\n',
    hi: '🎉 *बढ़िया खबर!*\nहमें एक ऐसी संपत्ति मिली है जो आपकी पसंद से काफी मेल खाती है।\nयहां पूरी जानकारी है: 👇\n\n',
    gu: '🎉 *સરસ સમાચાર!*\nઅમને એક પ્રોપર્ટી મળી છે જે તમારી પસંદગીઓ સાથે નજીકથી મેળ ખાય છે.\nવિગતો અહીં છે: 👇\n\n',
  },
};

const PROPERTY_MESSAGE_DELAY_MS = 900;

function waitForPropertyMessage() {
  return new Promise((resolve) => setTimeout(resolve, PROPERTY_MESSAGE_DELAY_MS));
}

async function sendPropertyCard(
  phone,
  property,
  { isFallback = false, lang = 'en', showHeader = true } = {}
) {
  if (showHeader) {
    const header = t(
      lang,
      isFallback ? PROPERTY_CARD_HEADER.fallback : PROPERTY_CARD_HEADER.match
    );
    await sendText(phone, header);
    await waitForPropertyMessage();
  }

  const imageUrls = (property.images || [])
    .map((image) => typeof image === 'string' ? image : image?.url)
    .filter(Boolean);
  if (property.imageUrl && !imageUrls.includes(property.imageUrl)) {
    imageUrls.unshift(property.imageUrl);
  }

  if (imageUrls.length) {
    for (const [index, imageUrl] of imageUrls.entries()) {
      if (index > 0) await waitForPropertyMessage();
      await sendImage(phone, imageUrl);
    }
  }

  await waitForPropertyMessage();
  await sendText(phone, propertyCardCaption(property, lang));
}

// ---------------------------------------------------------------------------
// 4. STEP ENGINE
// ---------------------------------------------------------------------------

const STEPS = {
  askLanguage: {
    kind: 'buttons',
    prompt: {
      en: "👋 Welcome to Heaven Homes!\n\nWe're delighted to help you find the right property based on your preferences.\nWhether you're looking to buy, rent, or rent out a property, our team is here to make the process simple.\n\n🌐 Please choose your preferred language.",
      hi: '👋 हेवन होम्स में आपका स्वागत है!\n\n🌐 कृपया अपनी पसंदीदा भाषा चुनें।',
      gu: '👋 હેવન હોમ્સમાં આપનું સ્વાગત છે!\n\n🌐 કૃપા કરી તમારી પસંદગીની ભાષા પસંદ કરો.',
    },
    options: [
      { id: 'en', title: { en: 'English', hi: 'English', gu: 'English' } },
      { id: 'hi', title: { en: 'हिंदी', hi: 'हिंदी', gu: 'हिंदी' } },
      { id: 'gu', title: { en: 'ગુજરાતી', hi: 'ગુજરાતી', gu: 'ગુજરાતી' } },
    ],
    apply: async (lead, value) => {
      lead.preferredLanguage = value;
    },
    next: async () => 'askName',
  },

  askName: {
    kind: 'text',
    prompt: {
      en: 'To get started, may I know your full name?',
      hi: 'शुरू करने के लिए, क्या मैं आपका पूरा नाम जान सकता हूँ?',
      gu: 'શરૂ કરવા માટે, શું હું તમારું પૂરું નામ જાણી શકું?',
    },
    validate: (v) => v.trim().length >= 2,
    apply: async (lead, value) => {
      lead.name = value.trim();
    },
    next: async () => 'askPhone',
  },

  askPhone: {
    kind: 'text',
    prompt: {
      en: ' To help you better and keep you updated about suitable properties,📱 Please enter your alternate contact number.',
      hi: ' धन्यवाद, राहुल! 😊 आपकी बहतर सहायता करन और आपको उपयक्त प्रॉपर्टी की जानकारी दत रहन क लिए, 📱 कपया अपना वकल्पिक सप नबर द कर',
      gu: 'આભાર, રાહલ! 😊 તમન વધ સારી રીત મદદ કરવા અન યોગ્ય પ્રોપર્ટીની મા હિતી આપતા રહવા માટ, 📱 કપા કરીન તમારો વક લ્પિક સપ નબર દાખલ કરો.',
    },
    validate: (v) => /^[+]?[\d\s-]{7,15}$/.test(v.trim()),
    apply: async (lead, value) => {
      lead.phoneNumber = value.trim();
    },
    next: async () => 'askSearchMode',
  },

  askSearchMode: {
    kind: 'buttons',
    prompt: {
      en: '🏡 How would you like to proceed with your property search?\n\n🔑 Search by Property ID\n🏘️ Explore Other Properties (Buy / Rent)',
      hi: '🏡 आप अपनी प्रॉपर्टी की खोज कैसे जारी रखना चाहेंगे?\n\n🔑 प्रॉपर्टी आईडी से खोजें\n🏘️ अन्य प्रॉपर्टी देखें (खरीदें / किराए पर लें)',
      gu: '🏡 તમે તમારી પ્રોપર્ટીની શોધ કેવી રીતે આગળ વધારવા માંગો છો?\n\n🔑 પ્રોપર્ટી ID થી શોધો\n🏘️ અન્ય પ્રોપર્ટી જુઓ (ખરીદો / ભાડે)',
    },
    options: [
      {
        id: 'search_by_property_id',
        title: { en: '🔑 Search by ID', hi: '🔑 ID से खोजें', gu: '🔑 ID થી શોધો' },
      },
      {
        id: 'explore_properties',
        title: { en: '🏘️ Explore Other', hi: '🏘️ अन्य देखें', gu: '🏘️ અન્ય જુઓ' },
      },
    ],
    next: async (_lead, value) =>
      value === 'search_by_property_id' ? 'askPropertyId' : 'askPropertyCategory',
    apply: async (lead, value) => {
      lead.propertyIdSearch = value === 'search_by_property_id';
    },
  },

  askPropertyId: {
    kind: 'text',
    prompt: {
      en: '🔑 Please enter the Property ID to view the property details.',
      hi: '🔑 प्रॉपर्टी की जानकारी देखने के लिए कृपया Property ID दर्ज करें।',
      gu: '🔑 પ્રોપર્ટીની વિગતો જોવા માટે કૃપા કરીને Property ID દાખલ કરો.',
    },
    validate: async (value, lead) => {
      const propertyId = value.trim().toUpperCase();
      if (!/^HH\d+$/.test(propertyId)) return false;
      const property = await Property.findOne({
        propertyId,
        status: 'available',
      }).lean();
      lead._searchedProperty = property;
      return Boolean(property);
    },
    onInvalid: async (lead, lang) => {
      if (lead._propertyIdLookupFailed) {
        lead._propertyIdLookupFailed = false;
        return {
          text: t(lang, {
            en: "I couldn't look up that Property ID just now. Please try again.",
            hi: 'अभी Property ID की जांच नहीं हो सकी। कृपया फिर से कोशिश करें।',
            gu: 'હમણાં Property ID તપાસી શકાયું નથી. કૃપા કરીને ફરીથી પ્રયાસ કરો.',
          }),
          buttons: [getMainMenuCtaButton(lang)],
        };
      }
      return {
        text: t(lang, {
          en: 'I could not find an available property with that ID. Please check it and try again.',
          hi: 'इस ID से कोई उपलब्ध प्रॉपर्टी नहीं मिली। कृपया ID जांचकर फिर से दर्ज करें।',
          gu: 'આ ID સાથે કોઈ ઉપલબ્ધ પ્રોપર્ટી મળી નથી. કૃપા કરીને ID તપાસીને ફરીથી દાખલ કરો.',
        }),
        buttons: [getMainMenuCtaButton(lang)],
      };
    },
    apply: async (lead) => {
      const property = lead._searchedProperty;
      if (!property) {
        throw new Error('[webhook] Property ID validation did not retain the property');
      }

      const categoryTab = property.categoryTab || '';
      const isRental =
        categoryTab.endsWith('_rent') ||
        property.propertyType === 'rent' ||
        property.monthlyRent != null;
      const isCommercial =
        categoryTab.startsWith('commercial_') ||
        property.propertyType === 'commercial' ||
        property.configuration === 'commercial';

      lead.leadType = 'seeker';
      lead.propertyCategory = isRental ? 'rent_lease' : 'purchase';
      lead.purchaseType = `${isCommercial ? 'commercial' : 'residential'}_${
        isRental ? 'rent' : 'buy'
      }`;
      lead.propertyType = property.propertyType;
      lead.propertySubType = property.propertySubType;
      lead.city = property.city;
      lead.area = property.area;
      lead.configuration = property.configuration;
      lead.budgetRange = property.budgetRange;
      lead.furnishing = property.furnishing;
      lead.spaceSize = property.spaceSize;

      const firstPropertyId = property._id.toString();
      lead.matchedProperties = [property._id];
      lead.currentPropertyIndex = 0;
      const otherMatches = await findMatchingProperties(lead);
      const additionalProperties = otherMatches.filter(
        (match) => match._id.toString() !== firstPropertyId
      );
      lead.matchedProperties = [
        property._id,
        ...additionalProperties.map((match) => match._id),
      ];
      lead._matchCache = [property, ...additionalProperties];
      lead.hadExactMatch = true;
      lead.propertyIdSearch = true;
      lead._searchedProperty = null;
    },
    next: async () => 'showing_property',
  },

  askArea: {
    kind: 'text',
    prompt: {
      en: 'In Surat, which area are you looking for a property in? 📍',
      hi: 'सूरत में आप किस क्षेत्र में संपत्ति ढूंढ रहे हैं? 📍',
      gu: 'સુરતમાં તમે કયા વિસ્તારમાં પ્રોપર્ટી શોધી રહ્યા છો? 📍',
    },
    retryPrompt: {
      en: '📍 Please type an area from the list above.',
      hi: '📍 कृपया ऊपर दी गई सूची से कोई क्षेत्र चुनें।',
      gu: '📍 કૃપા કરી ઉપરની યાદીમાંથી વિસ્તાર પસંદ કરો.',
    },
    validate: async (v, lead) => {
      const areas = await getAreasForCity(lead.city);
      if (areas.length === 0) return Boolean(placeKey(v));
      return Boolean(matchPlace(v, areas));
    },
    onInvalid: async (lead, lang) => {
      lead.areaAttempts = (lead.areaAttempts || 0) + 1;
      const areas = await getAreasForCity(lead.city);
      const areaList = formatPlaceListMultiline(areas) || '📍(none yet)';
      if (lead.areaAttempts >= 3) {
        lead.step = 'completed';
        return {
          text: t(lang, {
            en: "Let's have one of our experts help you find the right area instead.",
            hi: 'सही क्षेत्र खोजने में हमारे किसी विशेषज्ञ को आपकी मदद करने दें।',
            gu: 'યોગ્ય વિસ્તાર શોધવામાં અમારા નિષ્ણાતને તમારી મદદ કરવા દો.',
          }),
          redirectTo: 'talkToExpertMessage',
        };
      }
      return {
        text: t(lang, {
          en: `We don't have listings there right now. Nearby areas we cover:\n${areaList}`,
          hi: `वहां अभी हमारी लिस्टिंग नहीं है। नज़दीकी क्षेत्र:\n${areaList}`,
          gu: `ત્યાં હાલમાં અમારી લિસ્ટિંગ નથી. નજીકના વિસ્તારો:\n${areaList}`,
        }),
      };
    },
    apply: async (lead, value) => {
      const areas = await getAreasForCity(lead.city);
      lead.area = matchPlace(value, areas) || toTitleCase(value);
      lead.areaAttempts = 0;
    },
    // City + area now come AFTER category and buy/rent sub type, so route to
    // the matching property-type question based on what was already chosen.
    next: async (lead) => {
      if (!lead.propertyCategory || !lead.purchaseType) return 'askPropertyCategory';
      if (lead.purchaseType === 'commercial_buy' || lead.purchaseType === 'commercial_rent') {
        return 'askCommercialPropertyType';
      }
      if (lead.purchaseType === 'residential_rent') return 'askRentResidentialType';
      return 'askResidentialPropertyType';
    },
  },

  askPropertyCategory: {
    kind: 'buttons',
    prompt: {
      en: 'Perfect! 🎉 How can we help you today?\n\n🏡 Buy Property (Residential, Commercial)\n🔑 Find a Rental Property (Residential, Commercial)\n🏠 Rent Out My Property',
      hi: 'बहुत बढ़िया! 🎉 आज हम आपकी कैसे मदद कर सकते हैं?\n\n🏡 प्रॉपर्टी खरीदें\n🔑 किराए की प्रॉपर्टी खोजें\n🏠 अपनी प्रॉपर्टी किराए पर दें',
      gu: 'ઉત્તમ! 🎉 આજે અમે તમને કેવી રીતે મદદ કરી શકીએ?\n\n🏡 પ્રોપર્ટી ખરીદો\n🔑 ભાડાની પ્રોપર્ટી શોધો\n🏠 મારી પ્રોપર્ટી ભાડે આપો',
    },
    options: [
      { id: 'purchase', title: { en: '🏡 Buy Property', hi: '🏡 प्रॉपर्टी खरीदें', gu: '🏡 પ્રોપર્ટી ખરીદો' } },
      { id: 'rent_lease', title: { en: '🔑 Rental Property', hi: '🔑 किराया खोजें', gu: '🔑 ભાડું શોધો' } },
      { id: 'rent_out', title: { en: '🏠 Rent/Sell Out', hi: '🏠 किराए पर दें', gu: '🏠 ભાડે આપો' } },
    ],
    apply: async (lead, value) => {
      if (value === 'rent_out') {
        lead.leadType = 'lister';
        lead.propertyCategory = 'rent_out';
        lead.propertyType = 'rent';
      } else {
        lead.leadType = 'seeker';
        lead.propertyCategory = value;
      }
    },
    next: async (lead) => {
      if (lead.leadType === 'lister') return 'listPropertyType';
      return lead.propertyCategory === 'rent_lease' ? 'askRentType' : 'askPurchaseType';
    },
  },

  // =======================================================================
  // SEEKER: BUY FLOW
  // =======================================================================
  askPurchaseType: {
    kind: 'buttons',
    prompt: {
      en: "Great choice! 🏡\nWe'll help you find the best property based on your preferences.\n\nWhat type of property would you like to purchase?",
      hi: 'बढ़िया चुनाव! 🏡\nहम आपकी पसंद के अनुसार सर्वोत्तम संपत्ति खोजने में मदद करेंगे।\n\nआप किस प्रकार की संपत्ति खरीदना चाहेंगे?',
      gu: 'સરસ પસંદગી! 🏡\nઅમે તમારી પસંદગીના આધારે શ્રેષ્ઠ પ્રોપર્ટી શોધવામાં મદદ કરીશું.\n\nતમે કયા પ્રકારની પ્રોપર્ટી ખરીદવા માંગો છો?',
    },
    options: [
      { id: 'residential_buy', title: { en: '🏠 Residential', hi: '🏠 आवासीय', gu: '🏠 રહેણાંક' } },
      { id: 'commercial_buy', title: { en: '🏢 Commercial', hi: '🏢 व्यावसायिक', gu: '🏢 વ્યાવસાયિક' } },
    ],
    apply: async (lead, value) => {
      lead.purchaseType = value;
      lead.propertyType = value === 'commercial_buy' ? 'commercial' : 'buy';
    },
    // City/area are asked next (before the residential/commercial type list).
    next: async (lead) => {
      lead.city = 'Surat';
      return 'askArea';
    },
  },

  askResidentialPropertyType: {
    kind: 'list',
    prompt: {
      en: 'Which type of residential property are you looking for?',
      hi: 'आप किस प्रकार की आवासीय संपत्ति ढूंढ रहे हैं?',
      gu: 'તમે કયા પ્રકારની રહેણાંક પ્રોપર્ટી શોધી રહ્યાં છો?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'apartment', title: { en: '🏢 Apartment / Flat', hi: '🏢 अपार्टमेंट / फ्लैट', gu: '🏢 એપાર્ટમેન્ટ / ફ્લેટ' } },
      { id: 'house', title: { en: '🏡 Independent House', hi: '🏡 स्वतंत्र घर', gu: '🏡 સ્વતંત્ર ઘર' } },
      { id: 'villa', title: { en: '🏘️ Villa', hi: '🏘️ विला', gu: '🏘️ વિલા' } },
      { id: 'builder_floor', title: { en: '🏠 Builder Floor', hi: '🏠 बिल्डर फ्लोर', gu: '🏠 બિલ્ડર ફ્લોર' } },
      { id: 'studio', title: { en: '🏙️ Studio Apartment', hi: '🏙️ स्टूडियो अपार्टमेंट', gu: '🏙️ સ્ટુડિયો એપાર્ટમેન્ટ' } },
      { id: 'penthouse', title: { en: '🌆 Penthouse', hi: '🌆 पेंटहाउस', gu: '🌆 પેન્ટહાઉસ' } },
      { id: 'farmhouse', title: { en: '🌳 Farmhouse', hi: '🌳 फार्महाउस', gu: '🌳 ફાર્મહાઉસ' } },
      { id: 'plot', title: { en: '🌱 Land / Plot', hi: '🌱 भूमि / प्लॉट', gu: '🌱 જમીન / પ્લોટ' } },
    ],
    apply: async (lead, value) => {
      lead.propertySubType = value;
    },
    next: async (lead) => lead.propertySubType === 'plot' ? 'askBudget' : 'askConfiguration',
  },

  askCommercialPropertyType: {
    kind: 'list',
    prompt: {
      en: 'Which type of commercial property are you looking for?',
      hi: 'आप किस प्रकार की व्यावसायिक संपत्ति ढूंढ रहे हैं?',
      gu: 'તમે કયા પ્રકારની વ્યાવસાયિક પ્રોપર્ટી શોધી રહ્યાં છો?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'office', title: { en: '🏢 Office Space', hi: '🏢 ऑफिस स्पेस', gu: '🏢 ઓફિસ સ્પેસ' } },
      { id: 'shop', title: { en: '🛍️ Shop / Retail', hi: '🛍️ दुकान / रिटेल', gu: '🛍️ દુકાન / રિટેલ' } },
      { id: 'showroom', title: { en: '🏬 Showroom', hi: '🏬 शोरूम', gu: '🏬 શોરૂમ' } },
      { id: 'warehouse', title: { en: '🏭 Warehouse / Godown', hi: '🏭 गोदाम', gu: '🏭 વેરહાઉસ / ગોડાઉન' } },
      { id: 'industrial', title: { en: '🏗️ Industrial Land / Factory', hi: '🏗️ औद्योगिक भूमि / फैक्ट्री', gu: '🏗️ ઔદ્યોગિક જમીન / ફેક્ટરી' } },
      { id: 'plot', title: { en: '🌱 Land / Plot', hi: '🌱 भूमि / प्लॉट', gu: '🌱 જમીન / પ્લોટ' } },
      { id: 'coworking', title: { en: '💼 Co-working Space', hi: '💼 को-वर्किंग स्पेस', gu: '💼 કો-વર્કિંગ સ્પેસ' } },
    ],
    apply: async (lead, value) => {
      lead.propertySubType = value;
      lead.configuration = 'commercial';
    },
    next: async (lead) => {
      if (lead.propertyCategory === 'rent_lease') return 'askCommercialSetupType';
      return 'askCommercialSpaceSize';
    },
  },

  askCommercialSetupType: {
    kind: 'list',
    prompt: {
      en: 'What type of setup are you looking for?',
      hi: 'आप किस प्रकार का सेटअप चाहते हैं?',
      gu: 'તમે કયા પ્રકારનું સેટઅપ ઇચ્છો છો?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'bare_shell', title: { en: '🏗️ Bare Shell', hi: '🏗️ बेयर शेल', gu: '🏗️ બેર શેલ' } },
      { id: 'unfurnished', title: { en: '🪑 Unfurnished', hi: '🪑 अनफर्निश्ड', gu: '🪑 અનફર્નિશ્ડ' } },
      { id: 'semi_furnished', title: { en: '🛋️ Semi-Furnished', hi: '🛋️ सेमी-फर्निश्ड', gu: '🛋️ સેમી-ફર્નિશ્ડ' } },
      { id: 'fully_furnished', title: { en: '✨ Fully Furnished', hi: '✨ पूरी तरह फर्निश्ड', gu: '✨ સંપૂર્ણ ફર્નિશ્ડ' } },
    ],
    apply: async (lead, value) => {
      lead.furnishing = value;
    },
    next: async () => 'askRentBudget',
  },

  askCommercialSpaceSize: {
    kind: 'list',
    prompt: {
      en: 'What size of commercial space are you looking for?',
      hi: 'आप किस आकार की व्यावसायिक जगह ढूंढ रहे हैं?',
      gu: 'તમે કયા કદની વ્યાવસાયિક જગ્યા શોધી રહ્યાં છો?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'upto_500', title: { en: '📐 Up to 500 Sq.Ft.', hi: '📐 500 वर्ग फीट तक', gu: '📐 500 ચો.ફૂટ સુધી' } },
      { id: '500_1000', title: { en: '📐 500-1,000 Sq.Ft.', hi: '📐 500-1,000 वर्ग फीट', gu: '📐 500-1,000 ચો.ફૂટ' } },
      { id: '1000_2000', title: { en: '📐 1,000-2,000 Sq.Ft.', hi: '📐 1,000-2,000 वर्ग फीट', gu: '📐 1,000-2,000 ચો.ફૂટ' } },
      { id: '2000_5000', title: { en: '📐 2,000-5,000 Sq.Ft.', hi: '📐 2,000-5,000 वर्ग फीट', gu: '📐 2,000-5,000 ચો.ફૂટ' } },
      { id: 'above_5000', title: { en: '📐 Above 5,000 Sq.Ft.', hi: '📐 5,000 वर्ग फीट से ऊपर', gu: '📐 5,000 ચો.ફૂટ થી વધુ' } },
    ],
    apply: async (lead, value) => {
      lead.spaceSize = value;
    },
    next: async (lead) =>
      lead.propertyCategory === 'rent_lease' ? 'CHECK_MATCH' : 'askBudget',
  },

  // =======================================================================
  // SEEKER: RENT / LEASE
  // =======================================================================
  askRentType: {
    kind: 'buttons',
    prompt: {
      en: '🔑 What type of property are you looking to rent?',
      hi: '🔑 आप किस प्रकार की संपत्ति किराए पर लेना चाहते हैं?',
      gu: '🔑 તમે કયા પ્રકારની પ્રોપર્ટી ભાડે લેવા માંગો છો?',
    },
    options: [
      { id: 'residential', title: { en: '🏠 Residential', hi: '🏠 आवासीय', gu: '🏠 રહેણાંક' } },
      { id: 'commercial', title: { en: '🏢 Commercial', hi: '🏢 व्यावसायिक', gu: '🏢 વ્યાવસાયિક' } },
    ],
    apply: async (lead, value, title) => {
      lead.rentTypeLabel = title;
      lead.purchaseType =
        value === 'commercial' ? 'commercial_rent' : 'residential_rent';
      lead.propertyType = value === 'commercial' ? 'commercial' : 'rent';
    },
    // City/area are asked next (before the residential/commercial type list).
    next: async (lead) => {
      lead.city = 'Surat';
      return 'askArea';
    },
  },

  askRentResidentialType: {
    kind: 'list',
    prompt: {
      en: "Please select the type of residential property you're looking for.",
      hi: 'कृपया उस आवासीय संपत्ति का प्रकार चुनें जिसे आप ढूंढ रहे हैं।',
      gu: 'કૃપા કરી તમે જે રહેણાંક પ્રોપર્ટી શોધી રહ્યાં છો તેનો પ્રકાર પસંદ કરો.',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'apartment', title: { en: '🏢 Apartment / Flat', hi: '🏢 अपार्टमेंट / फ्लैट', gu: '🏢 એપાર્ટમેન્ટ / ફ્લેટ' } },
      { id: 'house', title: { en: '🏡 Independent House', hi: '🏡 स्वतंत्र घर', gu: '🏡 સ્વતંત્ર ઘર' } },
      { id: 'villa', title: { en: '🏘️ Villa', hi: '🏘️ विला', gu: '🏘️ વિલા' } },
      { id: 'builder_floor', title: { en: '🏠 Builder Floor', hi: '🏠 बिल्डर फ्लोर', gu: '🏠 બિલ્ડર ફ્લોર' } },
      { id: 'bunglow', title: { en: '🏙️ Bunglow', hi: '🏙️ बंगला', gu: '🏙️ બંગલો' } },
      { id: 'pg', title: { en: '🛏️ PG (Paying Guest)', hi: '🛏️ पीजी (पेइंग गेस्ट)', gu: '🛏️ પીજી (પેઇંગ ગેસ્ટ)' } },
      { id: 'farmhouse', title: { en: '🏡 Farmhouse', hi: '🏡 फार्महाउस', gu: '🏡 ફાર્મહાઉસ' } },
    ],
    apply: async (lead, value) => {
      lead.propertySubType = value;
    },
    next: async () => 'askRentConfiguration',
  },

  askRentConfiguration: {
    kind: 'list',
    prompt: {
      en: 'Which configuration would you prefer?',
      hi: 'आप कौन सा कॉन्फ़िगरेशन पसंद करेंगे?',
      gu: 'તમે કયું કન્ફિગરેશન પસંદ કરશો?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: '1bhk', title: { en: '🏠 1 BHK', hi: '🏠 1 BHK', gu: '🏠 1 BHK' } },
      { id: '2bhk', title: { en: '🏠 2 BHK', hi: '🏠 2 BHK', gu: '🏠 2 BHK' } },
      { id: '3bhk', title: { en: '🏠 3 BHK', hi: '🏠 3 BHK', gu: '🏠 3 BHK' } },
      { id: '4bhk', title: { en: '🏠 4+ BHK', hi: '🏠 4+ BHK', gu: '🏠 4+ BHK' } },
    ],
    apply: async (lead, value) => {
      lead.configuration = value === '1rk' ? '1bhk' : value;
    },
    next: async () => 'askFurnishing',
  },

  askConfiguration: {
    kind: 'list',
    prompt: {
      en: 'Which configuration best suits your requirements?',
      hi: 'आपकी आवश्यकताओं के लिए कौन सा कॉन्फ़िगरेशन सबसे उपयुक्त है?',
      gu: 'તમારી જરૂરિયાતો માટે કયું કન્ફિગરેશન સૌથી યોગ્ય છે?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: '1bhk', title: { en: '🏠 1 BHK', hi: '🏠 1 BHK', gu: '🏠 1 BHK' } },
      { id: '2bhk', title: { en: '🏠 2 BHK', hi: '🏠 2 BHK', gu: '🏠 2 BHK' } },
      { id: '3bhk', title: { en: '🏠 3 BHK', hi: '🏠 3 BHK', gu: '🏠 3 BHK' } },
      { id: '4bhk', title: { en: '🏠 4 BHK', hi: '🏠 4 BHK', gu: '🏠 4 BHK' } },
      { id: '5bhk_plus', title: { en: '🏠 5+ BHK', hi: '🏠 5+ BHK', gu: '🏠 5+ BHK' } },
      { id: 'duplex', title: { en: '🏘️ Duplex', hi: '🏘️ डुप्लेक्स', gu: '🏘️ ડુપ્લેક્સ' } },
    ],
    apply: async (lead, value) => {
      lead.configuration = value === '1rk' ? '1bhk' : value;
    },
    next: async (lead) =>
      lead.propertyCategory === 'rent_lease' ? 'askFurnishing' : 'askBudget',
  },

  askFurnishing: {
    kind: 'buttons',
    prompt: {
      en: '🛋️ What furnishing option are you looking for?',
      hi: '🛋️ आप कौन सा फर्निशिंग विकल्प चाहते हैं?',
      gu: '🛋️ તમે કયો ફર્નિશિંગ વિકલ્પ ઇચ્છો છો?',
    },
    options: [
      { id: 'unfurnished', title: { en: '🪑 Unfurnished', hi: '🪑 अनफर्निश्ड', gu: '🪑 અનફર્નિશ્ડ' } },
      { id: 'semi_furnished', title: { en: '🛋️ Semi-Furnished', hi: '🛋️ सेमी-फर्निश्ड', gu: '🛋️ સેમી-ફર્નિશ્ડ' } },
      { id: 'fully_furnished', title: { en: '✨ Fully Furnished', hi: '✨ पूरी तरह फर्निश्ड', gu: '✨ સંપૂર્ણ ફર્નિશ્ડ' } },
    ],
    apply: async (lead, value) => {
      lead.furnishing = value;
    },
    next: async () => 'askRentBudget',
  },

  askRentBudget: {
    kind: 'list',
    prompt: {
      en: '💰 What is your monthly rental budget?',
      hi: '💰 आपका मासिक किराया बजट क्या है?',
      gu: '💰 તમારું માસિક ભાડું બજેટ શું છે?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: '15k_25k', title: { en: '💵 ₹15,000-₹25,000', hi: '💵 ₹15,000-₹25,000', gu: '💵 ₹15,000-₹25,000' } },
      { id: '25k_35k', title: { en: '💵 ₹25,000-₹35,000', hi: '💵 ₹25,000-₹35,000', gu: '💵 ₹25,000-₹35,000' } },
      { id: '35k_50k', title: { en: '💵 ₹35,000-₹50,000', hi: '💵 ₹35,000-₹50,000', gu: '💵 ₹35,000-₹50,000' } },
      { id: 'above_50k', title: { en: '💎 Above ₹50,000', hi: '💎 ₹50,000 से ऊपर', gu: '💎 ₹50,000 થી વધુ' } },
    ],
    apply: async (lead, value, title) => {
      lead.rentBudgetLabel = title;
      lead.budgetRange = {
        '15k_25k': 'mid',
        '25k_35k': 'high',
        '35k_50k': 'luxury',
        above_50k: 'luxury',
      }[value];
    },
    next: async () => 'CHECK_MATCH',
  },

  askBudget: {
    kind: 'list',
    prompt: {
      en: '💰 What is your preferred budget for this property?',
      hi: '💰 इस संपत्ति के लिए आपका पसंदीदा बजट क्या है?',
      gu: '💰 આ પ્રોપર્ટી માટે તમારું પસંદગીનું બજેટ શું છે?',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: '30L_50L', title: { en: '💵 ₹30L – ₹50L', hi: '💵 ₹30L – ₹50L', gu: '💵 ₹30L – ₹50L' } },
      { id: '50L_75L', title: { en: '💵 ₹50L – ₹75L', hi: '💵 ₹50L – ₹75L', gu: '💵 ₹50L – ₹75L' } },
      { id: '75L_1Cr', title: { en: '💵 ₹75L – ₹1Cr', hi: '💵 ₹75L – ₹1Cr', gu: '💵 ₹75L – ₹1Cr' } },
      { id: 'above_1Cr', title: { en: '💎 Above ₹1Cr', hi: '💎 ₹1Cr से ऊपर', gu: '💎 ₹1Cr થી વધુ' } },
    ],
    apply: async (lead, value) => {
      lead.budgetRange = value;
    },
    next: async () => 'askSellFirstOrBuyDirect',
  },

  askSellFirstOrBuyDirect: {
    kind: 'buttons',
    prompt: {
      en: 'Are you looking to sell one of your properties first and then purchase another property, or are you looking to purchase directly?',
      hi: 'क्या आप पहले अपनी कोई संपत्ति बेचना चाहते हैं और फिर दूसरी संपत्ति खरीदना चाहते हैं, या सीधे खरीदना चाहते हैं?',
      gu: 'શું તમે પહેલા તમારી કોઈ પ્રોપર્ટી વેચવા માંગો છો અને પછી બીજી પ્રોપર્ટી ખરીદવા માંગો છો, કે સીધા ખરીદવા માંગો છો?',
    },
    options: [
      { id: 'buy_directly', title: { en: '🏠 Buy directly', hi: '🏠 सीधे खरीदें', gu: '🏠 સીધા ખરીદો' } },
      { id: 'sell_then_buy', title: { en: '💰 Sell then Buy', hi: '💰 बेचें फिर खरीदें', gu: '💰 વેચો પછી ખરીદો' } },
    ],
    apply: async (lead, value) => {
      lead.investmentType = value;
    },
    next: async () => 'CHECK_MATCH',
  },

  CHECK_MATCH: {
    kind: 'system',
    run: async (lead) => {
      try {
        const matches = await findMatchingProperties(lead);
        lead.matchedProperties = matches.map((p) => p._id);
        lead.currentPropertyIndex = 0;
        lead._matchCache = matches;
      } catch (err) {
        console.error('[webhook] Property match failed:', err);
        lead.matchedProperties = [];
        lead.currentPropertyIndex = 0;
        lead._matchCache = [];
        lead.hadExactMatch = false;
        lead.propertyIdSearch = false;
      }

      pushEnquiry(lead);

      if (!lead.currentStatus || lead.currentStatus === 'new') {
        pushStatusChange(lead, 'active', 'system', 'Completed qualification flow');
      }
    },
    next: async (lead) =>
      lead.matchedProperties.length > 0 ? 'showing_property' : 'no_match',
  },

  showing_property: {
    kind: 'message',
    prompt: () => ({
      en: 'Would you like to express interest, see another, or talk to an agent?',
      hi: 'क्या आप रुचि दिखाना चाहेंगे, दूसरी देखना चाहेंगे, या एजेंट से बात करना चाहेंगे?',
      gu: 'શું તમે રસ બતાવવા માંગો છો, બીજી જોવા માંગો છો, કે એજન્ટ સાથે વાત કરવા માંગો છો?',
    }),
    dynamicOptions: async (lead) => {
      const ids = (lead.matchedProperties || []).map((id) => id.toString());
      const opts = [];
      for (const pid of ids) {
        opts.push({
          id: `interested::${pid}`,
          title: { en: '✅ Interested', hi: '✅ रुचि है', gu: '✅ રસ છે' },
        });
        opts.push({
          id: `show_another::${pid}`,
          title: { en: '🔁 Show Another', hi: '🔁 और दिखाएं', gu: '🔁 બીજું બતાવો' },
        });
      }
      opts.push({
        id: 'talk_to_agent',
        title: { en: '📞 Talk to Agent', hi: '📞 एजेंट से बात करें', gu: '📞 એજન્ટ સાથે વાત કરો' },
      });
      return opts;
    },
    apply: async (lead, value) => {
      const [action, taggedPropertyId] = value.split('::');

      if (action === 'interested') {
        const propertyId = taggedPropertyId;
        lead.interested = propertyId;

        try {
          const property = await Property.findById(propertyId).lean();
          if (property) pushInterest(lead, property);
        } catch (e) {
          console.error('[webhook] Failed to snapshot interest:', e);
        }

        const current = lead.currentStatus || 'new';
        if (['new', 'active', 'contacted'].includes(current)) {
          pushStatusChange(lead, 'interested', 'whatsapp_bot', 'Expressed interest in a property');
        }

        await Property.findByIdAndUpdate(propertyId, { $inc: { inquiries: 1 } });
      } else if (action === 'show_another') {
        const ids = (lead.matchedProperties || []).map((id) => id.toString());
        const tappedIdx = ids.indexOf(taggedPropertyId);
        const baseIdx = tappedIdx === -1 ? lead.currentPropertyIndex || 0 : tappedIdx;
        const nextIdx = baseIdx + 1;

        if (nextIdx >= ids.length) {
          lead._allPropertiesShown = true;
        } else {
          lead.currentPropertyIndex = nextIdx;
        }
      }
    },
    next: async (lead, value) => {
      if (value.startsWith('interested::')) return 'askSiteVisit';
      if (value === 'talk_to_agent') return 'completed';
      if (value.startsWith('show_another::') && lead._allPropertiesShown) {
        return 'all_properties_shown';
      }
      return 'showing_property';
    },
  },

  all_properties_shown: {
    kind: 'message',
    prompt: () => ({
      en: "You've seen all the properties we currently have matching your search. 🏡\n\nWould you like us to notify you when a new matching property is listed, or talk to an expert now?",
      hi: 'आपने अपनी खोज से मेल खाने वाली हमारी सभी संपत्तियां देख ली हैं। 🏡\n\nक्या आप चाहेंगे कि नई मेल खाने वाली संपत्ति लिस्ट होने पर हम आपको सूचित करें, या अभी किसी विशेषज्ञ से बात करें?',
      gu: 'તમે તમારી શોધ સાથે મેળ ખાતી અમારી બધી પ્રોપર્ટીઝ જોઈ લીધી છે. 🏡\n\nશું તમે ઈચ્છો છો કે નવી મેળ ખાતી પ્રોપર્ટી લિસ્ટ થાય ત્યારે અમે તમને જણાવીએ, કે અત્યારે નિષ્ણાત સાથે વાત કરો?',
    }),
    options: [
      { id: 'notify_me', title: { en: '🔔 Notify Me', hi: '🔔 सूचित करें', gu: '🔔 જણાવો' } },
      { id: 'talk_to_expert', title: { en: '📞 Talk to Expert', hi: '📞 विशेषज्ञ से बात करें', gu: '📞 નિષ્ણાત સાથે વાત કરો' } },
    ],
    next: async () => 'completed',
  },

  no_match: {
    kind: 'message',
    prompt: () => ({
      en: "Thank you for sharing your requirements. 🙏\n\nWe couldn't find an exact property matching all of your selected preferences at the moment.\nHowever, we found a few similar properties that may still be a great fit for you.",
      hi: 'अपनी आवश्यकताएं साझा करने के लिए धन्यवाद। 🙏\n\nअभी हमारे पास आपकी सभी पसंदों से मेल खाती कोई सटीक संपत्ति नहीं मिली।\nलेकिन हमें कुछ समान संपत्तियां मिलीं जो आपके लिए उपयुक्त हो सकती हैं।',
      gu: 'તમારી જરૂરિયાતો શેર કરવા બદલ આભાર. 🙏\n\nહાલમાં અમને તમારી બધી પસંદગીઓ સાથે મેળ ખાતી ચોક્કસ પ્રોપર્ટી મળી નથી.\nપણ અમને કેટલીક સમાન પ્રોપર્ટીઓ મળી જે તમારા માટે યોગ્ય થઈ શકે છે.',
    }),
    options: [
      { id: 'notify_me', title: { en: '🔔 Notify Me', hi: '🔔 सूचित करें', gu: '🔔 જણાવો' } },
      { id: 'talk_to_expert', title: { en: '📞 Talk to Expert', hi: '📞 विशेषज्ञ से बात करें', gu: '📞 નિષ્ણાત સાથે વાત કરો' } },
    ],
    next: async () => 'completed',
  },

  askSiteVisit: {
    kind: 'buttons',
    prompt: () => ({
      en: "That's wonderful! 😊\nOne of our property experts will personally assist you with complete details, pricing, and availability.\n\nWould you also like to schedule a site visit?",
      hi: 'बहुत बढ़िया! 😊\nहमारे प्रॉपर्टी एक्सपर्ट्स में से एक व्यक्तिगत रूप से आपको पूरी जानकारी, मूल्य और उपलब्धता के साथ सहायता करेगा।\n\nक्या आप साइट विजिट भी शेड्यूल करना चाहेंगे?',
      gu: 'તે અદ્ભુત છે! 😊\nઅમારા પ્રોપર્ટી નિષ્ણાતોમાંથી એક વ્યક્તિગત રીતે તમને સંપૂર્ણ વિગતો, ભાવ અને ઉપલબ્ધતા સાથે સહાય કરશે.\n\nશું તમે સાઇટ વિઝિટ પણ શેડ્યૂલ કરવા માંગો છો?',
    }),
    options: [
      { id: 'yes', title: { en: '✅ Yes, Book a Visit', hi: '✅ हां, बुक करें', gu: '✅ હા, બુક કરો' } },
      { id: 'no', title: { en: '❌ Not Right Now', hi: '❌ अभी नहीं', gu: '❌ હમણાં નહીં' } },
    ],
    next: async (lead, value) => {
      if (value !== 'yes') return 'completed';
      if (lead.propertyCategory === 'rent_lease') return 'askSiteVisitConfirm';
      return 'askVisitDateTime';
    },
  },

  askSiteVisitConfirm: {
    kind: 'buttons',
    prompt: () => ({
      en: "Excellent choice! 🏡\n\n⚠️ *Important Note Regarding Site Visit*\n• Site visit charges: ₹250 per visit\n• A site visit can be rescheduled a maximum of 2 times.\n\nDo you want to proceed?",
      hi: 'बढ़िया चुनाव! 🏡\n\n⚠️ *साइट विजिट के बारे में महत्वपूर्ण सूचना*\n• साइट विजिट शुल्क: ₹250 प्रति विजिट\n• साइट विजिट अधिकतम 2 बार पुनर्निर्धारित की जा सकती है।\n\nक्या आप आगे बढ़ना चाहते हैं?',
      gu: 'ઉત્તમ પસંદગી! 🏡\n\n⚠️ *સાઇટ વિઝિટ અંગે મહત્વની નોંધ*\n• સાઇટ વિઝિટ ચાર્જ: ₹250 પ્રતિ મુલાકાત\n• સાઇટ વિઝિટ મહત્તમ 2 વખત ફરી શેડ્યૂલ કરી શકાય છે.\n\nશું તમે આગળ વધવા માંગો છો?',
    }),
    options: [
      { id: 'confirm_visit', title: { en: '✅ Confirm Visit', hi: '✅ पुष्टि करें', gu: '✅ પુષ્ટિ કરો' } },
      { id: 'cancel_visit', title: { en: '❌ Cancel', hi: '❌ रद्द करें', gu: '❌ રદ કરો' } },
    ],
    next: async (lead, value) =>
      value === 'confirm_visit' ? 'askVisitDateTime' : 'completed',
  },

  askVisitDateTime: {
    kind: 'text',
    prompt: {
      en: 'Excellent choice! 🏡\nPlease share your preferred date and time for the site visit.\n📅 Example: 28 July 2026, 🕒 11:00 AM',
      hi: 'बढ़िया चुनाव! 🏡\nकृपया साइट विजिट के लिए अपनी पसंदीदा तारीख और समय बताएं।\n📅 उदाहरण: 28 जुलाई 2026, 🕒 11:00 AM',
      gu: 'ઉત્તમ પસંદગી! 🏡\nકૃપા કરી સાઇટ વિઝિટ માટે તમારી પસંદગીની તારીખ અને સમય જણાવો.\n📅 ઉદાહરણ: 28 જુલાઈ 2026, 🕒 11:00 AM',
    },
    validate: (v) => v.trim().length >= 4,
    apply: async (lead, value) => {
      const rawText = value.trim();
      lead.siteVisit = rawText;
      lead.markModified('siteVisit');

      try {
        const SiteVisit = (await import('@/lib/models/SiteVisit')).default;
        const PropertyModel = (await import('@/lib/models/Property')).default;

        const parsed = parseVisitDateTime(rawText);
        const propertyId =
          lead.interested || lead.matchedProperties?.[lead.currentPropertyIndex];

        if (!propertyId) {
          console.warn('[webhook] No property selected for site visit');
          return;
        }

        const property = await PropertyModel.findById(propertyId).lean();

        await SiteVisit.create({
          lead: lead._id,
          property: propertyId,
          leadName: lead.name || '',
          leadPhone: lead.phone || '',
          propertyTitle: property?.title || '',
          propertyCode: property?.propertyId || '',
          scheduledDate: parsed.date,
          scheduledTime: parsed.time,
          rawPreferredDateTime: rawText,
          status: 'scheduled',
          source: 'whatsapp_bot',
        });

        pushStatusChange(
          lead,
          'site_visit_scheduled',
          'whatsapp_bot',
          `Site visit booked for ${rawText}`
        );

        console.log('[webhook] SiteVisit created:', {
          raw: rawText,
          parsedDate: parsed.date.toISOString(),
          parsedTime: parsed.time,
        });
      } catch (err) {
        console.error('[webhook] Failed to create SiteVisit:', err);
      }
    },
    next: async () => 'completed',
  },

  // =======================================================================
  // LISTER: RENT OUT MY PROPERTY
  // =======================================================================
  listPropertyType: {
    kind: 'buttons',
    prompt: {
      en: "Excellent choice! 🏡 We'll help you find genuine tenants for your property as quickly as possible.\nTo get started, please answer a few quick questions about your property.\n\n🏠 What type of property would you like to rent out?\nPlease choose one of the options below.",
      hi: 'बढ़िया चुनाव! 🏡 हम आपकी संपत्ति के लिए जल्द से जल्द असली किरायेदार खोजने में मदद करेंगे।\n\n🏠 आप किस प्रकार की संपत्ति किराए पर देना चाहेंगे?',
      gu: 'ઉત્તમ પસંદગી! 🏡 અમે તમારી પ્રોપર્ટી માટે ઝડપથી અસલી ભાડૂતો શોધવામાં મદદ કરીશું.\n\n🏠 તમે કયા પ્રકારની પ્રોપર્ટી ભાડે આપવા માંગો છો?',
    },
    options: [
      { id: 'residential', title: { en: '🏠 Residential', hi: '🏠 आवासीय', gu: '🏠 રહેણાંક' } },
      { id: 'commercial', title: { en: '🏢 Commercial', hi: '🏢 व्यावसायिक', gu: '🏢 વ્યાવસાયિક' } },
    ],
    apply: async (lead, value) => {
      lead.propertyCategory = 'rent_out';
      lead.purchaseType =
        value === 'commercial' ? 'commercial_rent' : 'residential_rent';
      lead.propertyType = value === 'commercial' ? 'commercial' : 'rent';
    },
    next: async (lead) =>
      lead.purchaseType === 'commercial_rent'
        ? 'listCommercialSubType'
        : 'listResidentialSubType',
  },

  listResidentialSubType: {
    kind: 'list',
    prompt: {
      en: '🏡 Please select your residential property type.',
      hi: '🏡 कृपया अपनी आवासीय संपत्ति का प्रकार चुनें।',
      gu: '🏡 કૃપા કરી તમારી રહેણાંક પ્રોપર્ટીનો પ્રકાર પસંદ કરો.',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'apartment', title: { en: '🏢 Apartment / Flat', hi: '🏢 अपार्टमेंट / फ्लैट', gu: '🏢 ફ્લેટ' } },
      { id: 'house', title: { en: '🏠 Independent House', hi: '🏠 स्वतंत्र घर', gu: '🏠 સ્વતંત્ર ઘર' } },
      { id: 'villa', title: { en: '🏘️ Villa', hi: '🏘️ विला', gu: '🏘️ વિલા' } },
      { id: 'builder_floor', title: { en: '🏢 Builder Floor', hi: '🏢 बिल्डर फ्लोर', gu: '🏢 બિલ્ડર ફ્લોર' } },
      { id: 'pg', title: { en: '🛏️ PG', hi: '🛏️ पीजी', gu: '🛏️ પીજી' } },
      { id: 'farmhouse', title: { en: '🌾 Farmhouse', hi: '🌾 फार्महाउस', gu: '🌾 ફાર્મહાઉસ' } },
    ],
    apply: async (lead, value) => {
      lead.propertySubType = value;
      lead.configuration = defaultConfigForSubType(value, false);
    },
    next: async () => 'listLocation',
  },

  listCommercialSubType: {
    kind: 'list',
    prompt: {
      en: 'Please select your commercial property type.',
      hi: 'कृपया अपनी व्यावसायिक संपत्ति का प्रकार चुनें।',
      gu: 'કૃપા કરી તમારી વ્યાવસાયિક પ્રોપર્ટીનો પ્રકાર પસંદ કરો.',
    },
    listButton: { en: 'Choose', hi: 'चुनें', gu: 'પસંદ કરો' },
    options: [
      { id: 'office', title: { en: '🏢 Office Space', hi: '🏢 ऑफिस स्पेस', gu: '🏢 ઓફિસ સ્પેસ' } },
      { id: 'shop', title: { en: '🛍️ Shop / Retail', hi: '🛍️ दुकान / रिटेल', gu: '🛍️ દુકાન' } },
      { id: 'showroom', title: { en: '🏬 Showroom', hi: '🏬 शोरूम', gu: '🏬 શોરૂમ' } },
      { id: 'warehouse', title: { en: '🏭 Warehouse', hi: '🏭 गोदाम', gu: '🏭 વેરહાઉસ' } },
      { id: 'coworking', title: { en: '🏢 Co-working Space', hi: '🏢 को-वर्किंग', gu: '🏢 કો-વર્કિંગ' } },
      { id: 'factory', title: { en: '🏭 Factory', hi: '🏭 फैक्ट्री', gu: '🏭 ફેક્ટરી' } },
    ],
    apply: async (lead, value) => {
      lead.propertySubType = value;
      lead.configuration = 'commercial';
    },
    next: async () => 'listLocation',
  },

  listLocation: {
    kind: 'text',
    prompt: {
      en: 'Where is your property located?\nPlease type your complete address House no.,/Block Name, City and Area/Locality. ✍️\nExample:3270, Near Hotel Rose, Vijay Nagar, Indore\n\nNote: Simply type your location and send the message.',
      hi: 'आपकी संपत्ति कहाँ स्थित है?\nकृपया अपना पूर्ण पता टाइप करें। ✍️\nउदाहरण:3270, होटल रोज़ के पास, विजय नगर, इंदौर',
      gu: 'તમારી પ્રોપર્ટી ક્યાં છે?\nકૃપા કરી તમારું પૂર્ણ પતા લખો. ✍️\nઉદાહરણ:3270, હોટેલ રોઝ નજીક, વિજય નગર, ઈન્દોર',
    },
    // Rent-out leads skip the generic city/area steps, so this is the ONLY place
    // we learn the property location. Require "Area, City" - a single word
    // would otherwise be saved as both the city and the area.
    validate: (v) => {
      const parts = String(v || '').split(',').map((p) => p.trim()).filter(Boolean);
      return parts.length >= 2 && parts.every((p) => p.length >= 2);
    },
    apply: async (lead, value) => {
      const parsed = parseCityArea(value);
      lead.city = parsed.city;
      lead.area = parsed.area;
      lead.listingDraft = { ...(lead.listingDraft || {}), location: value.trim() };
      lead.markModified('listingDraft');
    },
    next: async () => 'listPrice',
  },

  listPrice: {
    kind: 'text',
    prompt: {
      en: '💰 What is your expected monthly rent for this property?\n✍️ Example: ₹22,000 per month\n\nNote: Simply type the amount and send the message.',
      hi: '💰 इस संपत्ति के लिए आपका अपेक्षित मासिक किराया क्या है?\n✍️ उदाहरण: ₹22,000 प्रति माह',
      gu: '💰 આ પ્રોપર્ટી માટે તમારું અપેક્ષિત માસિક ભાડું શું છે?\n✍️ ઉદાહરણ: ₹22,000 પ્રતિ મહિને',
    },
    validate: (v) => parseIndianCurrency(v) !== null && parseIndianCurrency(v) > 0,
    apply: async (lead, value) => {
      const amount = parseIndianCurrency(value);
      lead.listingDraft = { ...(lead.listingDraft || {}), price: amount };
      lead.markModified('listingDraft');
      lead.budgetRange = bucketRentAmount(amount);
    },
    next: async () => 'listFurnishing',
  },

  listFurnishing: {
    kind: 'buttons',
    prompt: {
      en: '🛋️ What is the furnishing status of your property?',
      hi: '🛋️ आपकी संपत्ति की फर्निशिंग स्थिति क्या है?',
      gu: '🛋️ તમારી પ્રોપર્ટીની ફર્નિશિંગ સ્થિતિ શું છે?',
    },
    options: [
      { id: 'unfurnished', title: { en: '🪑 Unfurnished', hi: '🪑 अनफर्निश्ड', gu: '🪑 અનફર્નિશ્ડ' } },
      { id: 'semi_furnished', title: { en: '🛋️ Semi-Furnished', hi: '🛋️ सेमी-फर्निश्ड', gu: '🛋️ સેમી-ફર્નિશ્ડ' } },
      { id: 'fully_furnished', title: { en: '✨ Fully Furnished', hi: '✨ पूरी तरह फर्निश्ड', gu: '✨ સંપૂર્ણ ફર્નિશ્ડ' } },
    ],
    apply: async (lead, value) => {
      lead.furnishing = value;
    },
    next: async () => 'listAvailability',
  },

  listAvailability: {
    kind: 'buttons',
    prompt: {
      en: '📅 When will your property be available for rent?\nPlease choose one of the options below.',
      hi: '📅 आपकी संपत्ति किराए के लिए कब उपलब्ध होगी?',
      gu: '📅 તમારી પ્રોપર્ટી ભાડા માટે ક્યારે ઉપલબ્ધ થશે?',
    },
    options: [
      { id: 'available_now', title: { en: '🚀 Available Now', hi: '🚀 अभी उपलब्ध', gu: '🚀 હમણાં ઉપલબ્ધ' } },
      { id: 'within_15_days', title: { en: '📆 Within 15 Days', hi: '📆 15 दिनों में', gu: '📆 15 દિવસમાં' } },
      { id: 'next_month', title: { en: '🗓️ Next Month', hi: '🗓️ अगले महीने', gu: '🗓️ આવતા મહિને' } },
    ],
    apply: async (lead, value, title) => {
      lead.timeline = title;
    },
    onAfterApply: async (lead) => {
      await createPendingRentOutListing(lead);
    },
    next: async () => 'listPhotos',
  },

  listPhotos: {
    kind: 'text',
    prompt: {
      en: 'Please share 3–10 clear photos of your property.\nPhotos help us showcase your property better and attract genuine tenants faster.\n\nNote: Simply upload the photos here.',
      hi: 'कृपया अपनी संपत्ति की 3–10 स्पष्ट तस्वीरें भेजें।\nतस्वीरें असली किरायेदारों को तेजी से आकर्षित करने में मदद करती हैं।',
      gu: 'કૃપા કરી તમારી પ્રોપર્ટીના 3–10 સ્પષ્ટ ફોટા મોકલો.\nફોટા અસલી ભાડૂતોને ઝડપથી આકર્ષે છે.',
    },
    validate: () => true,
    next: async () => 'listPhotos',
  },
};

// ---------------------------------------------------------------------------
// 5. TERMINAL MESSAGES
// ---------------------------------------------------------------------------

const TERMINAL_MESSAGES = {
  talkToExpertMessage: (lang) =>
    t(lang, {
      en: `Still have questions? We'd be happy to assist you.\n\nYou can directly connect with ${EXPERT_NAME}.\n\n📞 Mobile: ${EXPERT_PHONE}\n\nFeel free to call anytime during business hours. 🏡`,
      hi: `अभी भी सवाल हैं? आप सीधे ${EXPERT_NAME} से जुड़ सकते हैं।\n\n📞 मोबाइल: ${EXPERT_PHONE}`,
      gu: `હજુ પ્રશ્નો છે? તમે સીધા ${EXPERT_NAME} સાથે જોડાઈ શકો છો.\n\n📞 મોબાઈલ: ${EXPERT_PHONE}`,
    }),
  notifyMeMessage: (lang) =>
    t(lang, {
      en: "Perfect! ✅ We'll keep an eye on new listings that match your preferences.\n\nThank you for choosing us. ❤️",
      hi: 'बढ़िया! ✅ हम आपकी पसंद से मेल खाने वाली नई लिस्टिंग पर नज़र रखेंगे।\n\nधन्यवाद। ❤️',
      gu: 'ઉત્તમ! ✅ અમે તમારી પસંદ સાથે મેળ ખાતી નવી લિસ્ટિંગ પર નજર રાખીશું.\n\nઆભાર. ❤️',
    }),
  thankYouGeneric: (lang) =>
    t(lang, {
      en: 'Thank you for your inquiry. 🙏 Our property agents will connect with you soon.',
      hi: 'आपकी पूछताछ के लिए धन्यवाद। 🙏 हमारे प्रॉपर्टी एजेंट जल्द ही आपसे संपर्क करेंगे।',
      gu: 'તમારી પૂછપરછ બદલ આભાર. 🙏 અમારા પ્રોપર્ટી એજન્ટ ટૂંક સમયમાં તમારો સંપર્ક કરશે.',
    }),
  visitConfirmed: (lang, lead, propertyTitle) =>
    t(lang, {
      en: `Thank you! ✅ Your site visit request has been successfully submitted.\n\n📍 Property: ${propertyTitle || 'N/A'}\n📅 Preferred: ${lead.siteVisit}\n\nOur property consultant will contact you shortly to confirm your appointment.\nWe look forward to helping you find your perfect property.\n\nTeam Heaven Homes ❤`,
      hi: `धन्यवाद! ✅ आपका साइट विजिट अनुरोध सफलतापूर्वक सबमिट हो गया है।\n\n📍 प्रॉपर्टी: ${propertyTitle || 'N/A'}\n📅 पसंदीदा: ${lead.siteVisit}\n\nहमारा प्रॉपर्टी सलाहकार जल्द ही पुष्टि के लिए संपर्क करेगा।\n\nटीम हेवन होम्स ❤`,
      gu: `આભાર! ✅ તમારી સાઇટ વિઝિટ વિનંતી સફળતાપૂર્વક સબમિટ થઈ ગઈ છે.\n\n📍 પ્રોપર્ટી: ${propertyTitle || 'N/A'}\n📅 પસંદગી: ${lead.siteVisit}\n\nઅમારો પ્રોપર્ટી સલાહકાર ટૂંક સમયમાં પુષ્ટિ માટે સંપર્ક કરશે.\n\nટીમ હેવન હોમ્સ ❤`,
    }),
  visitCancelled: (lang) =>
    t(lang, {
      en: "No problem! 🙏 Thank you for your inquiry. Our property agents will connect with you soon.",
      hi: 'कोई बात नहीं! 🙏 पूछताछ के लिए धन्यवाद। हमारे प्रॉपर्टी एजेंट जल्द ही आपसे संपर्क करेंगे।',
      gu: 'કોઈ વાંધો નહીં! 🙏 પૂછપરછ બદલ આભાર. અમારા પ્રોપર્ટી એજન્ટ ટૂંક સમયમાં તમારો સંપર્ક કરશે.',
    }),
  listingConfirmed: (lang) =>
    t(lang, {
      en: "Thank you! ✅\nYour property images have been successfully submitted. Our team will review the details, and if your property is approved for listing, we'll notify you shortly. We look forward to helping you showcase your property to the right buyers.\n\nTeam Heaven Homes ❤️",
      hi: 'धन्यवाद! ✅\nआपकी संपत्ति की तस्वीरें सफलतापूर्वक सबमिट हो गई हैं। हमारी टीम विवरण की समीक्षा करेगी और लिस्टिंग स्वीकृत होने पर हम आपको सूचित करेंगे।\n\nटीम हेवन होम्स ❤️',
      gu: 'આભાર! ✅\nતમારી પ્રોપર્ટીના ફોટા સફળતાપૂર્વક સબમિટ થયા છે. અમારી ટીમ વિગતોની સમીક્ષા કરશે અને લિસ્ટિંગ મંજૂર થાય તો અમે તમને જણાવીશું.\n\nટીમ હેવન હોમ્સ ❤️',
    }),
};

// ---------------------------------------------------------------------------
// 6. SENDING A STEP'S PROMPT
// ---------------------------------------------------------------------------

async function resolveOptions(step, lead) {
  if (step.dynamicOptions) return step.dynamicOptions(lead);
  return step.options;
}

async function sendStepPrompt(phone, stepId, step, lead, { showPropertyHeader = true } = {}) {
  const lang = lead.preferredLanguage || 'en';
  const promptTri = typeof step.prompt === 'function' ? step.prompt(lead) : step.prompt;

  let showingPropertyCtx = null;
  if (stepId === 'showing_property') {
    const idx = lead.currentPropertyIndex || 0;
    const id = lead.matchedProperties?.[idx];
    const property =
      lead._matchCache?.[idx] || (id ? await Property.findById(id) : null);

    if (!property) {
      await sendText(
        phone,
        t(lang, {
          en: 'Sorry, that listing is no longer available. Let me check for others.',
          hi: 'माफ़ कीजिए, वह लिस्टिंग अब उपलब्ध नहीं है। मैं अन्य देखता हूं।',
          gu: 'માફ કરશો, તે લિસ્ટિંગ હવે ઉપલબ્ધ નથી. હું બીજી તપાસું છું.',
        })
      );
      return;
    }

    const pid = (id || property._id).toString();
    const buttons = [
      { id: `interested::${pid}`, title: { en: '✅ Interested', hi: '✅ रुचि है', gu: '✅ રસ છે' } },
      { id: `show_another::${pid}`, title: { en: '🔁 Show Another', hi: '🔁 और दिखाएं', gu: '🔁 બીજું બતાવો' } },
      { id: 'talk_to_agent', title: { en: '📞 Talk to Agent', hi: '📞 एजेंट से बात करें', gu: '📞 એજન્ટ સાથે વાત કરો' } },
    ];
    showingPropertyCtx = { property, buttons };
  }

  if (lead) {
    const loggedOptions = showingPropertyCtx
      ? showingPropertyCtx.buttons
      : (await resolveOptions(step, lead)) || [];
    pushConversation(lead, {
      direction: 'out',
      type: step.kind === 'buttons' || step.kind === 'list' || step.kind === 'message' ? 'interactive' : 'text',
      text: t(lang, promptTri),
      payload: {
        stepId,
        options: loggedOptions.map((o) => ({
          id: o.id,
          title: typeof o.title === 'object' ? t(lang, o.title) : o.title,
        })),
      },
    });
    try {
      await lead.save();
    } catch (e) {
      console.error('[webhook] Failed to save conversation log:', e);
    }
  }

  if (showingPropertyCtx) {
    await sendPropertyCard(phone, showingPropertyCtx.property, {
      isFallback: !lead.hadExactMatch,
      lang,
      showHeader: showPropertyHeader && !lead.propertyIdSearch,
    });

    await waitForPropertyMessage();
 
    const buttons = showingPropertyCtx.buttons.map((o) => ({ id: o.id, title: t(lang, o.title) }));
    await sendButtons(phone, t(lang, promptTri), buttons);
    return;
  }

  if (step.kind === 'text') {
    await sendText(phone, t(lang, promptTri));
    return;
  }
  if (step.kind === 'buttons') {
    const options = await resolveOptions(step, lead);
    const buttons = options.map((o) => ({ id: o.id, title: t(lang, o.title) }));
    await sendButtons(phone, t(lang, promptTri), buttons);
    return;
  }
  if (step.kind === 'list') {
    const options = await resolveOptions(step, lead);
    const rows = options.map((o) => ({ id: o.id, title: t(lang, o.title) }));
    await sendList(phone, t(lang, promptTri), t(lang, step.listButton), rows);
    return;
  }
  if (step.kind === 'message' && step.options) {
    const buttons = step.options.map((o) => ({ id: o.id, title: t(lang, o.title) }));
    await sendButtons(phone, t(lang, promptTri), buttons);
    return;
  }
}

// ---------------------------------------------------------------------------
// 7. CORE HANDLER
// ---------------------------------------------------------------------------

async function sendWelcomeAndLanguagePrompt(phone, lead) {
  lead.step = 'askLanguage';
  await lead.save();
  await sendStepPrompt(phone, 'askLanguage', STEPS.askLanguage, lead);
}

function getMainMenuCtaButton(lang) {
  return {
    id: 'main_menu',
    title: t(lang, { en: '📋 Main Menu', hi: '📋 मुख्य मेनू', gu: '📋 મુખ્ય મેનૂ' }),
  };
}

function getEndFlowCtaButtons(lang) {
  return [getMainMenuCtaButton(lang)];
}

async function sendTerminalMessage(phone, lead, text, terminalTag, ctaButtons) {
  const lang = lead.preferredLanguage || 'en';
  const buttons = ctaButtons || getEndFlowCtaButtons(lang);

  if (lead) {
    pushConversation(lead, {
      direction: 'out',
      type: 'interactive',
      text,
      payload: { terminal: terminalTag, options: buttons },
    });
    try { await lead.save(); } catch (e) { console.error(e); }
  }

  await sendButtons(phone, text, buttons);
}

async function finalizeCompletedStepMessage(phone, lead, fromStepId, answerValue) {
  const lang = lead.preferredLanguage || 'en';

  let outboundText = '';

  if (fromStepId === 'showing_property' && answerValue === 'talk_to_agent') {
    outboundText = TERMINAL_MESSAGES.talkToExpertMessage(lang);
  } else if (fromStepId === 'no_match' || fromStepId === 'all_properties_shown') {
    outboundText =
      answerValue === 'notify_me'
        ? TERMINAL_MESSAGES.notifyMeMessage(lang)
        : TERMINAL_MESSAGES.talkToExpertMessage(lang);
  } else if (fromStepId === 'askSiteVisit' && answerValue === 'no') {
    outboundText = TERMINAL_MESSAGES.thankYouGeneric(lang);
  } else if (fromStepId === 'askSiteVisitConfirm' && answerValue === 'cancel_visit') {
    outboundText = TERMINAL_MESSAGES.visitCancelled(lang);
  } else if (fromStepId === 'askVisitDateTime') {
    let propertyTitle = '';
    try {
      const pid = lead.interested || lead.matchedProperties?.[lead.currentPropertyIndex];
      if (pid) {
        const prop = await Property.findById(pid).select('title').lean();
        propertyTitle = prop?.title || '';
      }
    } catch (e) {
      console.error('[webhook] Failed to resolve property title for visit message:', e);
    }
    outboundText = TERMINAL_MESSAGES.visitConfirmed(lang, lead, propertyTitle);
  } else {
    outboundText = TERMINAL_MESSAGES.thankYouGeneric(lang);
  }

  await sendTerminalMessage(phone, lead, outboundText, fromStepId);
}

async function advanceThroughSystemSteps(lead, stepId) {
  let currentId = stepId;
  let guard = 0;
  while (STEPS[currentId]?.kind === 'system' && guard < 5) {
    const step = STEPS[currentId];
    if (step.run) await step.run(lead);
    currentId = await step.next(lead);
    guard++;
  }
  return currentId;
}

async function completeRentOutListing(phone, lead) {
  const lang = lead.preferredLanguage || 'en';
  lead.step = 'completed';
  lead.ownedPropertyDraft = null;
  lead.listingDraft = {};
  lead.markModified('listingDraft');

  pushEnquiry(lead);

  const current = lead.currentStatus || 'new';
  if (current === 'new' || current === 'active') {
    pushStatusChange(lead, 'active', 'whatsapp_bot', 'Listed property via bot');
  }

  touchLeadActivity(lead);
  await lead.save();

  const message = TERMINAL_MESSAGES.listingConfirmed(lang);
  await sendTerminalMessage(phone, lead, message, 'listingConfirmed');
}

async function handleListPhotosMessage(phone, lead, incoming) {
  const lang = lead.preferredLanguage || 'en';

  // NOTE: handleMessage() already logged this inbound message and touched
  // lead activity, so we don't repeat that here (it used to log every photo/
  // text twice in the CRM conversation history).
  if (incoming.type === 'image') {
    try {
      const { url, publicId } = await saveWhatsAppImageToCloudinary(incoming.mediaId);
      const property = await Property.findById(lead.ownedPropertyDraft);
      if (!property) {
        const errMsg = t(lang, {
          en: 'Something went wrong with your listing. Please type *restart* to try again.',
          hi: 'लिस्टिंग में समस्या आई। कृपया *restart* लिखें।',
          gu: 'લિસ્ટિંગમાં સમસ્યા આવી. કૃપા કરી *restart* લખો.',
        });
        pushConversation(lead, { direction: 'out', type: 'text', text: errMsg });
        await lead.save();
        await sendText(phone, errMsg);
        return;
      }

      property.images = property.images || [];
      if (property.images.length >= 10) {
        await completeRentOutListing(phone, lead);
        return;
      }

      property.images.push({ url, publicId });
      if (!property.imageUrl) {
        property.imageUrl = url;
        property.imagePublicId = publicId;
      }
      await property.save();

      const count = property.images.length;
      if (count >= 10) {
        await completeRentOutListing(phone, lead);
        return;
      }

      let replyText;
      if (count < 3) {
        replyText = t(lang, {
          en: `📸 Photo ${count} received. Please send ${3 - count} more (3–10 photos needed).`,
          hi: `📸 फोटो ${count} प्राप्त हुई। कृपया और ${3 - count} भेजें (3–10 फोटो चाहिए)।`,
          gu: `📸 ફોટો ${count} મળ્યો. કૃપા કરી વધુ ${3 - count} મોકલો (3–10 ફોટા જોઈએ).`,
        });
      } else {
        replyText = t(lang, {
          en: `📸 Photo ${count} received. Send more if you like (up to 10), or type *done* to finish.`,
          hi: `📸 फोटो ${count} प्राप्त हुई। और भेज सकते हैं (अधिकतम 10), या पूरा करने के लिए *done* लिखें।`,
          gu: `📸 ફોટો ${count} મળ્યો. વધુ મોકલી શકો (મહત્તમ 10), અથવા પૂરું કરવા *done* લખો.`,
        });
      }

      pushConversation(lead, { direction: 'out', type: 'text', text: replyText });
      await lead.save();
      await sendText(phone, replyText);
    } catch (err) {
      console.error('[webhook] Photo upload failed:', err);
      const errMsg = t(lang, {
        en: "Sorry, that photo didn't upload correctly. Please try sending it again.",
        hi: 'माफ़ कीजिए, वह फोटो अपलोड नहीं हो पाई। कृपया दोबारा भेजें।',
        gu: 'માફ કરશો, તે ફોટો અપલોડ થયો નહીં. કૃપા કરી ફરી મોકલો.',
      });
      pushConversation(lead, { direction: 'out', type: 'text', text: errMsg });
      await lead.save();
      await sendText(phone, errMsg);
    }
    return;
  }

  const text = (incoming.text || '').trim().toLowerCase();
  if (['done', 'finish', 'complete', 'ok'].includes(text)) {
    const property = await Property.findById(lead.ownedPropertyDraft);
    const count = property?.images?.length || 0;
    if (!property || count < 3) {
      const msg = t(lang, {
        en: `Please send at least 3 clear photos of your property before finishing. (${count}/3 received)`,
        hi: `पूरा करने से पहले कृपया कम से कम 3 तस्वीरें भेजें। (${count}/3 प्राप्त)`,
        gu: `પૂરું કરતા પહેલા ઓછામાં ઓછા 3 ફોટા મોકલો. (${count}/3 મળ્યા)`,
      });
      pushConversation(lead, { direction: 'out', type: 'text', text: msg });
      await lead.save();
      await sendText(phone, msg);
      return;
    }
    await completeRentOutListing(phone, lead);
    return;
  }

  const msg = t(lang, {
    en: 'Please upload a photo here. After 3 photos you can type *done*, or keep sending up to 10.',
    hi: 'कृपया यहां फोटो अपलोड करें। 3 फोटो के बाद *done* लिख सकते हैं, या 10 तक भेजते रहें।',
    gu: 'કૃપા કરી અહીં ફોટો અપલોડ કરો. 3 ફોટો પછી *done* લખી શકો, અથવા 10 સુધી મોકલતા રહો.',
  });
  pushConversation(lead, { direction: 'out', type: 'text', text: msg });
  await lead.save();
  await sendText(phone, msg);
}

async function handleMessage(phone, incoming) {
  let lead = await Lead.findOne({ phone });

  if (!lead) {
    lead = await Lead.create({
      phone,
      step: 'askLanguage',
      lastIncomingMessageId: incoming.wamid || '',
      lastInboundMessageAt: new Date(),
      currentStatus: 'new',
    });
    if (incoming.type === 'text') {
      pushConversation(lead, { direction: 'in', type: 'text', text: incoming.text });
    } else if (incoming.type === 'interactive') {
      pushConversation(lead, {
        direction: 'in',
        type: 'interactive',
        text: incoming.title || '',
        payload: { id: incoming.id, title: incoming.title },
      });
    }
    await lead.save();
    await sendWelcomeAndLanguagePrompt(phone, lead);
    return;
  }

  // ---- ATOMIC DEDUP ----
  if (incoming.wamid) {
    const updated = await Lead.findOneAndUpdate(
      { _id: lead._id, lastIncomingMessageId: { $ne: incoming.wamid } },
      {
        $set: {
          lastIncomingMessageId: incoming.wamid,
          lastInboundMessageAt: new Date(),
          lastActivityAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      console.log(`[webhook] Duplicate wamid dropped for ${phone}`);
      return;
    }
    lead = updated;
  }

  const lang = lead.preferredLanguage || 'en';
  const text = incoming.type === 'text' ? incoming.text : '';
  const interactiveId = incoming.type === 'interactive' ? incoming.id : undefined;
  const interactiveTitle = incoming.type === 'interactive' ? incoming.title : undefined;

  if (incoming.type === 'text') {
    pushConversation(lead, { direction: 'in', type: 'text', text });
  } else if (incoming.type === 'interactive') {
    pushConversation(lead, {
      direction: 'in',
      type: 'interactive',
      text: interactiveTitle || '',
      payload: { id: interactiveId, title: interactiveTitle },
    });
  } else if (incoming.type === 'image') {
    pushConversation(lead, {
      direction: 'in',
      type: 'image',
      mediaId: incoming.mediaId,
    });
  }
  lead.lastInboundMessageAt = new Date();
  touchLeadActivity(lead);

  const siteVisitAction = interactiveId?.match(
    /^site_visit_(confirm|reschedule|cancel)::([a-f\d]{24})$/i
  );
  if (siteVisitAction) {
    const [, action, siteVisitId] = siteVisitAction;
    const visit = await SiteVisit.findOne({
      _id: siteVisitId,
      lead: lead._id,
      status: { $in: ['scheduled', 'pending', 'rescheduled'] },
    });

    if (!visit) {
      const message = 'This site visit is no longer active. Please contact our team if you need help.';
      pushConversation(lead, { direction: 'out', type: 'text', text: message });
      await lead.save();
      await sendText(phone, message);
      return;
    }

    const visitDate = visit.scheduledDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const visitTime = visit.scheduledTime || visit.scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
    const customerName = lead.name?.trim() || 'there';

    if (action === 'confirm') {
      const message = `✅ Site Visit Confirmed!\n\nThank you, ${customerName}! 😊 Your site visit has been confirmed successfully. 🏡\n\n🏡 Property: ${visit.propertyTitle}\n📅 Date: ${visitDate}\n⏰ Time: ${visitTime}\n\nWe look forward to seeing you! 🏡`;
      pushConversation(lead, { direction: 'out', type: 'text', text: message });
      await lead.save();
      await sendText(phone, message);
      return;
    }

    if (action === 'reschedule') {
      lead.activeSiteVisit = visit._id;
      lead.step = 'rescheduleSiteVisit';
      const message = `🔄 Reschedule Your Site Visit\n\nNo problem, ${customerName}! 😊\n📅 Please enter your preferred new date and time for the site visit.\nExample: 15 October 2026, 4:00 PM`;
      pushConversation(lead, { direction: 'out', type: 'text', text: message });
      await lead.save();
      await sendText(phone, message);
      return;
    }

    visit.status = 'cancelled';
    await visit.save();
    lead.activeSiteVisit = undefined;
    const message = `❌ Site Visit Cancelled Successfully\n\nHello, ${customerName}! Your site visit for ${visit.propertyTitle} has been cancelled successfully. If you'd like to explore other properties or schedule a new visit, we're happy to help. 😊`;
    await sendTerminalMessage(phone, lead, message, 'siteVisitCancelled', [
      { id: 'main_menu', title: '🏠 Main Menu' },
    ]);
    return;
  }

  if (lead.step === 'rescheduleSiteVisit') {
    const datePattern = /\b\d{1,2}\s*(?:st|nd|rd|th)?\s+[a-z]+\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:today|tomorrow|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const timePattern = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i;
    if (!datePattern.test(text) || !timePattern.test(text)) {
      const message = 'Please enter both a date and time. Example: 15 October 2026, 4:00 PM';
      pushConversation(lead, { direction: 'out', type: 'text', text: message });
      await lead.save();
      await sendText(phone, message);
      return;
    }

    const visit = await SiteVisit.findOne({
      _id: lead.activeSiteVisit,
      lead: lead._id,
      status: { $in: ['scheduled', 'pending', 'rescheduled'] },
    });
    if (!visit) {
      lead.activeSiteVisit = undefined;
      lead.step = 'completed';
      const message = 'This site visit is no longer active. Please contact our team if you need help.';
      pushConversation(lead, { direction: 'out', type: 'text', text: message });
      await lead.save();
      await sendText(phone, message);
      return;
    }

    const parsed = parseVisitDateTime(text);
    visit.rescheduledFrom = {
      date: visit.scheduledDate,
      time: visit.scheduledTime,
      rescheduledAt: new Date(),
    };
    visit.scheduledDate = parsed.date;
    visit.scheduledTime = parsed.time;
    visit.rawPreferredDateTime = text.trim();
    visit.status = 'rescheduled';
    visit.reminderSentAt = undefined;
    await visit.save();

    lead.siteVisit = text.trim();
    lead.activeSiteVisit = undefined;
    lead.step = 'completed';
    const message = `✅ Site Visit Rescheduled!\n\n🏡 Property: ${visit.propertyTitle}\n📅 Date: ${visit.scheduledDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}\n⏰ Time: ${visit.scheduledTime}`;
    pushConversation(lead, { direction: 'out', type: 'text', text: message });
    await lead.save();
    await sendText(phone, message);
    return;
  }

  if (isStopFollowUpAction(interactiveId, text)) {
    pushStatusChange(lead, 'lost', 'whatsapp_bot', 'Lead opted out');
    await unsubscribeLead(lead);

    const msg = t(lang, {
      en: 'Thank you for your inquiry.\n\nTeam Heaven Homes ❤️',
      hi: 'आपकी पूछताछ के लिए धन्यवाद।\n\nटीम हेवन होम्स ❤️',
      gu: 'તમારી પૂછપરછ બદલ આભાર.\n\nટીમ હેવન હોમ્સ ❤️',
    });
    await sendTerminalMessage(phone, lead, msg, 'stopFollowUp', [getMainMenuCtaButton(lang)]);
    return;
  }

  if (isRestartAction(interactiveId, text)) {
    const name = resetLeadProgress(lead);
    lead.step = 'askLanguage';
    pushStatusChange(lead, 'active', 'whatsapp_bot', 'Restarted flow');
    await lead.save();

    const introTri = {
      en: `No problem${name ? `, ${name}` : ''}! Let's start a fresh search. 🔄`,
      hi: `कोई बात नहीं${name ? `, ${name}` : ''}! चलिए फिर से खोजते हैं। 🔄`,
      gu: `કોઈ વાંધો નહીં${name ? `, ${name}` : ''}! ચાલો ફરીથી શોધીએ. 🔄`,
    };
    await sendText(phone, t(lang, introTri));

    await sendStepPrompt(phone, lead.step, STEPS[lead.step], lead);
    return;
  }

  if (interactiveId === 'main_menu') {
    const wasUnsubscribed = lead.followUpStatus === 'unsubscribed';
    resetLeadProgress(lead);
    if (wasUnsubscribed) lead.followUpStatus = 'unsubscribed';
    lead.step = 'askSearchMode';
    pushStatusChange(lead, 'active', 'whatsapp_bot', 'Returned to main menu');
    await lead.save();
    await sendStepPrompt(phone, 'askSearchMode', STEPS.askSearchMode, lead);
    return;
  }

  if (lead.step === 'askEmail') {
    lead.step = 'askPropertyCategory';
    await lead.save();
    await sendStepPrompt(phone, lead.step, STEPS[lead.step], lead);
    return;
  }
  if (lead.step === 'askCity') {
    lead.city = 'Surat';
    lead.step = 'askArea';
    await lead.save();
    await sendStepPrompt(phone, lead.step, STEPS[lead.step], lead);
    return;
  }

  if (lead.step === 'completed') {
    const name = resetLeadProgress(lead);
    pushStatusChange(lead, 'active', 'whatsapp_bot', 'Returned after completion');
    await lead.save();

    const welcomeTri = {
      en: `Welcome back${name ? `, ${name}` : ''}! 👋`,
      hi: `वापसी पर स्वागत है${name ? `, ${name}` : ''}! 👋`,
      gu: `પાછા આવવા બદલ સ્વાગત${name ? `, ${name}` : ''}! 👋`,
    };
    await sendText(phone, t(lang, welcomeTri));

    await sendStepPrompt(phone, lead.step, STEPS[lead.step], lead);
    return;
  }

  if (lead.step === 'askPurchaseTimeline' || lead.step === 'askMoveInTimeline') {
    const nextStepId = lead.step === 'askPurchaseTimeline'
      ? 'askSellFirstOrBuyDirect'
      : lead.purchaseType === 'commercial_rent' && !lead.spaceSize
        ? 'askCommercialSpaceSize'
        : 'CHECK_MATCH';
    lead.timeline = undefined;
    lead.step = await advanceThroughSystemSteps(lead, nextStepId);
    await lead.save();
    await sendStepPrompt(phone, lead.step, STEPS[lead.step], lead);
    return;
  }

  if (isContinueAction(interactiveId, text)) {
    touchLeadActivity(lead);
    const step = STEPS[lead.step];
    if (step) {
      await lead.save();
      await sendStepPrompt(phone, lead.step, step, lead);
      return;
    }
  }

  touchLeadActivity(lead);

  if (lead.step === 'listPhotos') {
    await handleListPhotosMessage(phone, lead, incoming);
    return;
  }

  const step = STEPS[lead.step];
  if (!step) {
    console.error(`[webhook] Unknown step "${lead.step}" for ${phone} - resetting.`);
    resetLeadProgress(lead);
    await lead.save();
    await sendStepPrompt(phone, 'askPropertyCategory', STEPS.askPropertyCategory, lead);
    return;
  }

  if (incoming.type !== 'text' && incoming.type !== 'interactive') {
    const msg = t(lang, {
      en: 'Sorry, I can only understand text and menu selections here. Please reply using the buttons/list, or type your answer.',
      hi: 'माफ़ कीजिए, यहां मैं केवल टेक्स्ट और मेनू चयन समझ सकता हूं। कृपया बटन/लिस्ट से उत्तर दें, या टाइप करें।',
      gu: 'માફ કરશો, અહીં હું ફક્ત ટેક્સ્ટ અને મેનૂ પસંદગી સમજી શકું છું. કૃપા કરી બટન/લિસ્ટથી જવાબ આપો, અથવા ટાઈપ કરો.',
    });
    pushConversation(lead, { direction: 'out', type: 'text', text: msg });
    await lead.save();
    await sendText(phone, msg);
    return;
  }

  const answerValue = interactiveId || text;
  const answerTitle = interactiveTitle || text;

  if (step.kind === 'text') {
    let isValid = text.length > 0;
    try {
      isValid = step.validate ? await step.validate(text, lead) : text.length > 0;
    } catch (err) {
      console.error(`[webhook] Validate failed on step "${lead.step}":`, err);
      isValid = lead.step === 'askArea' && Boolean(placeKey(text));
      if (lead.step === 'askPropertyId') lead._propertyIdLookupFailed = true;
    }

    if (!isValid) {
      if (step.onInvalid) {
        const result = await step.onInvalid(lead, lang);
        await lead.save();

        if (result.redirectTo) {
          const errMsg = `${result.text}\n\n${TERMINAL_MESSAGES[result.redirectTo](lang)}`;
          await sendTerminalMessage(phone, lead, errMsg, `${lead.step}_maxAttempts`);
          return;
        }

        const errMsg = result.text;
        if (result.buttons) {
          await sendTerminalMessage(phone, lead, errMsg, `${lead.step}_invalid`, result.buttons);
          return;
        }
        pushConversation(lead, { direction: 'out', type: 'text', text: errMsg });
        await lead.save();
        await sendText(phone, errMsg);

        // Re-ask the SAME question so the user always knows what's
        // expected next. If the step has a retryPrompt, use that instead —
        // askArea's normal prompt starts with "Great choice!" which reads
        // wrong on a retry.
        const retryStep = step.retryPrompt
          ? { ...step, prompt: step.retryPrompt, retryPrompt: undefined }
          : step;
        await sendStepPrompt(phone, lead.step, retryStep, lead);
        return;
      }

      const errMsg = t(lang, ERROR_PREFIX) + t(lang, step.prompt);
      pushConversation(lead, { direction: 'out', type: 'text', text: errMsg });
      await lead.save();
      await sendText(phone, errMsg);
      return;
    }
  } else {
    const options = await resolveOptions(step, lead);
    const validIds = (options || []).map((o) => o.id);
    if (!interactiveId || !validIds.includes(interactiveId)) {
      await sendStepPrompt(phone, lead.step, step, lead);
      return;
    }
  }

  if (step.apply) await step.apply(lead, answerValue, answerTitle);
  if (step.onAfterApply) await step.onAfterApply(lead);

  const fromStepId = lead.step;
  let nextStepId = await step.next(lead, answerValue);
  nextStepId = await advanceThroughSystemSteps(lead, nextStepId);

  const nextStep = STEPS[nextStepId];
  lead.step = nextStepId;
  await lead.save();

  if (nextStepId === 'completed') {
    await finalizeCompletedStepMessage(phone, lead, fromStepId, answerValue);
    return;
  }

  if (!nextStep) {
    console.error(`[webhook] Unknown next step "${nextStepId}" - resetting.`);
    resetLeadProgress(lead);
    await lead.save();
    await sendStepPrompt(phone, 'askPropertyCategory', STEPS.askPropertyCategory, lead);
    return;
  }

  await sendStepPrompt(phone, nextStepId, nextStep, lead);
}

// ---------------------------------------------------------------------------
// 8. ROUTE HANDLERS
// ---------------------------------------------------------------------------

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = getWhatsAppConfig().verifyToken;

  console.log('[webhook] GET', {
    mode,
    hasToken: Boolean(token),
    tokenMatches: Boolean(expected) && token === expected,
    hasChallenge: Boolean(challenge),
  });

  if (!mode && !token && !challenge) {
    return NextResponse.json({
      ok: true,
      endpoint: '/api/webhook',
      hint: 'Paste this HTTPS URL into Meta as Callback URL. Verify token must match WHATSAPP_VERIFY_TOKEN in .env',
    });
  }

  if (!expected) {
    console.error('[webhook] WHATSAPP_VERIFY_TOKEN is not set — save .env and restart the dev server');
    return new NextResponse('Server misconfigured', { status: 500 });
  }

  if (mode !== 'subscribe') {
    console.warn('[webhook] Verify failed: hub.mode is not subscribe', { mode });
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (token !== expected) {
    console.warn('[webhook] Verify failed: hub.verify_token does not match WHATSAPP_VERIFY_TOKEN');
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  console.log('[webhook] Meta verification succeeded');
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

const phoneQueues = new Map();

function enqueueForPhone(phone, task) {
  const prev = phoneQueues.get(phone) || Promise.resolve();
  const run = prev.then(task, task);
  const settled = run.catch(() => {});
  phoneQueues.set(phone, settled);
  settled.finally(() => {
    if (phoneQueues.get(phone) === settled) {
      phoneQueues.delete(phone);
    }
  });
  return run;
}

export async function POST(request) {
  console.log('[webhook] POST hit', {
    ua: request.headers.get('user-agent'),
    contentType: request.headers.get('content-type'),
  });

  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) {
        console.error('[webhook] DB unavailable - acking without processing.');
        return NextResponse.json({ ok: true });
      }
    }

    const body = await request.json();
    const allMessages = parseIncomingMessages(body);
    const configuredId = getWhatsAppConfig().phoneNumberId;
    const messages = allMessages.filter((m) => {
      if (!m.businessPhoneNumberId || !configuredId) return true;
      if (m.businessPhoneNumberId === configuredId) return true;
      console.warn(
        '[webhook] Ignoring message for a DIFFERENT Meta test number. ' +
          'Replies from this server always use WHATSAPP_PHONE_NUMBER_ID ' +
          `(${configuredId} = +1 555 187 6077). Incoming was ` +
          `${m.businessPhoneNumberId} / +${m.businessDisplayPhone || '?'}. ` +
          'Use only one Meta app: token + phone-number-id + webhook must belong to 187-6077. ' +
          'Remove this ngrok URL from the other app (178-2019).'
      );
      return false;
    });
    console.log('[webhook] payload', {
      object: body?.object,
      messageCount: messages.length,
      ignoredOtherNumber: allMessages.length - messages.length,
      from: messages.map((m) => m.from),
      businessPhoneNumberId: messages.map((m) => m.businessPhoneNumberId),
      businessDisplayPhone: messages.map((m) => m.businessDisplayPhone),
    });
    if (messages.length === 0) return NextResponse.json({ ok: true });

    await Promise.all(
      messages.map((incoming) =>
        enqueueForPhone(incoming.from, () => handleMessage(incoming.from, incoming))
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Unhandled error:', err);
    return NextResponse.json({ ok: true });
  }
}