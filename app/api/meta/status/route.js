import { NextResponse } from 'next/server';
import { getWhatsAppConfigStatus } from '@/lib/whatsapp-config';

/**
 * Public health check for Meta/WhatsApp env (booleans only — no secrets).
 * Use after saving .env and restarting `npm run dev`.
 */
export async function GET() {
  const whatsapp = getWhatsAppConfigStatus();
  const readyForWebhookVerify = whatsapp.verifyTokenSet;
  const readyToSendMessages =
    whatsapp.accessTokenSet && whatsapp.phoneNumberIdSet;

  return NextResponse.json({
    ok: readyForWebhookVerify,
    whatsapp,
    hints: {
      webhookCallbackPath: '/api/webhook',
      verifyTokenMustMatchMetaDashboard: true,
      localDevNeedsHttpsTunnel:
        'Meta cannot reach localhost — use ngrok/cloudflare tunnel and set Callback URL to https://…/api/webhook',
      restartAfterEnvChange: 'Stop and restart `npm run dev` after editing .env',
    },
    readyForWebhookVerify,
    readyToSendMessages,
    callbackUrlExample:
      'https://YOUR-NGROK-HOST.ngrok-free.dev/api/webhook',
    oneAppRule:
      'Token, phone-number-id, verify token, and webhook must all come from the SAME Meta app. This project sends as 1336071012923403 (+1 555 187 6077). The other test number (+1 555 178 2019) is a different app — do not mix them.',
  });
}
