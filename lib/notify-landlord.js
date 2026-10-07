// lib/notify-landlord.js
import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

async function sendWhatsAppText(to, text) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[notify-landlord] Missing WhatsApp env vars');
    return false;
  }
  try {
    const res = await axios.post(
      graphMessagesUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text.slice(0, 4096), preview_url: false },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.status >= 200 && res.status < 300;
  } catch (err) {
    console.error(
      '[notify-landlord] Send failed:',
      err.response?.data?.error?.message || err.message
    );
    return false;
  }
}

/**
 * Notify a landlord that their rent-out listing was approved.
 */
export async function notifyLandlordApproved(property) {
  if (!property?.ownerPhone) {
    console.warn('[notify-landlord] No ownerPhone on property', property?._id);
    return false;
  }

  const price = Number(property.price || 0).toLocaleString('en-IN');
  const text =
    `🎉 *Great news!*\n\n` +
    `Your property has been *approved* and is now live on Heaven Homes.\n\n` +
    `🏢 *${property.title}*\n` +
    `📍 ${property.area}, ${property.city}\n` +
    `💰 ₹${price}/month\n` +
    `🛋 ${(property.furnishing || '').replace(/_/g, ' ')}\n` +
    `🆔 ${property.propertyId}\n\n` +
    `Prospective tenants can now view your listing and our team will contact you when someone shows interest. Thank you for choosing Heaven Homes! ❤️`;

  return sendWhatsAppText(property.ownerPhone, text);
}

/**
 * Notify a landlord that their listing was rejected / deactivated.
 */
export async function notifyLandlordRejected(property, reason = '') {
  if (!property?.ownerPhone) return false;

  const text =
    `Hello,\n\n` +
    `Thank you for submitting your property to Heaven Homes.\n\n` +
    `After review, we are unable to list *${property.title}* at this time.` +
    (reason ? `\n\nReason: ${reason}` : '') +
    `\n\nIf you believe this is a mistake, please reply to this message and our team will assist you.\n\nTeam Heaven Homes`;

  return sendWhatsAppText(property.ownerPhone, text);
}

/**
 * Notify a landlord that their property has been marked as rented.
 */
export async function notifyLandlordRented(property) {
  if (!property?.ownerPhone) return false;

  const text =
    `Congratulations! 🎉\n\n` +
    `Your property *${property.title}* has been marked as *Rented* on Heaven Homes.\n\n` +
    `Thank you for trusting us with your listing. If you have more properties to rent out, just send us a message anytime.\n\nTeam Heaven Homes ❤️`;

  return sendWhatsAppText(property.ownerPhone, text);
}