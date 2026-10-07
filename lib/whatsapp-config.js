/**
 * Meta / WhatsApp Cloud API settings — swap credentials via .env only.
 */

const DEFAULT_GRAPH_VERSION = 'v21.0';

export function getWhatsAppConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '',
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() || '',
    graphVersion:
      process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    wabaId: process.env.WHATSAPP_WABA_ID?.trim() || '',
    expertName: process.env.EXPERT_CONTACT_NAME?.trim() || 'our team',
    expertPhone: process.env.EXPERT_CONTACT_PHONE?.trim() || '+919510833599',
  };
}

export function graphMessagesUrl(phoneNumberId, graphVersion) {
  const cfg = getWhatsAppConfig();
  const id = phoneNumberId || cfg.phoneNumberId;
  const version = graphVersion || cfg.graphVersion;
  return `https://graph.facebook.com/${version}/${id}/messages`;
}

export function graphMediaUrl(mediaId, graphVersion) {
  const cfg = getWhatsAppConfig();
  const version = graphVersion || cfg.graphVersion;
  return `https://graph.facebook.com/${version}/${mediaId}`;
}

/** Safe summary for logs / debug endpoints (no secret values). */
export function getWhatsAppConfigStatus() {
  const c = getWhatsAppConfig();
  return {
    accessTokenSet: Boolean(c.accessToken),
    phoneNumberIdSet: Boolean(c.phoneNumberId),
    verifyTokenSet: Boolean(c.verifyToken),
    appSecretSet: Boolean(c.appSecret),
    graphVersion: c.graphVersion,
    wabaIdSet: Boolean(c.wabaId),
    phoneNumberIdPreview: c.phoneNumberId
      ? `${c.phoneNumberId.slice(0, 4)}…${c.phoneNumberId.slice(-4)}`
      : null,
  };
}

export function assertWhatsAppSendReady() {
  const c = getWhatsAppConfig();
  if (!c.accessToken || !c.phoneNumberId) {
    return {
      ok: false,
      error: 'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID',
    };
  }
  return { ok: true, config: c };
}
