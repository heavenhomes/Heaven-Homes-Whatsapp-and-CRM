// lib/activity/log.js
import Activity from '@/lib/models/Activity';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

/**
 * Extract the current user from the request's session cookie.
 * Returns { actorType, actorId, actorName, actorUsername } or a system default.
 */
export function getActorFromRequest(request) {
  try {
    const token = request?.cookies?.get(SESSION_COOKIE_NAME)?.value;
    const payload = verifySessionToken(token);
    if (!payload) {
      return {
        actorType: 'system',
        actorId: null,
        actorName: 'System',
        actorUsername: '',
      };
    }
    return {
      actorType: payload.role || 'system',
      actorId: payload.sub || null,
      actorName: payload.name || 'Unknown',
      actorUsername: payload.username || '',
    };
  } catch {
    return {
      actorType: 'system',
      actorId: null,
      actorName: 'System',
      actorUsername: '',
    };
  }
}

/**
 * Fire-and-forget activity logger.
 *
 * Usage:
 *   await logActivity(request, {
 *     action: 'lead.created',
 *     category: 'lead',
 *     description: `New lead from WhatsApp: ${lead.name}`,
 *     targetType: 'Lead',
 *     targetId: lead._id,
 *     targetLabel: lead.name,
 *     severity: 'success',
 *     changes: { source: 'whatsapp_bot' },
 *   });
 *
 * Never throws — logging failures don't break the main request.
 */
export async function logActivity(request, entry) {
  try {
    const actor = getActorFromRequest(request);

    const doc = await Activity.create({
      actorType: entry.actorType ?? actor.actorType,
      actorId: entry.actorId ?? actor.actorId,
      actorName: entry.actorName ?? actor.actorName,
      actorUsername: entry.actorUsername ?? actor.actorUsername,

      action: entry.action,
      category: entry.category,
      description: entry.description,
      targetType: entry.targetType || '',
      targetId: entry.targetId || null,
      targetLabel: entry.targetLabel || '',
      changes: entry.changes || {},
      metadata: entry.metadata || {},
      severity: entry.severity || 'info',

      ip:
        request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
        request?.headers?.get?.('x-real-ip') ||
        '',
      userAgent: request?.headers?.get?.('user-agent') || '',
    });

    return doc;
  } catch (err) {
    console.error('[activity/log] failed to write activity:', err.message);
    return null;
  }
}