// lib/webhook-dedup.js
const processedMessages = new Map();
const TTL_MS = 5 * 60 * 1000;
const MAX_SIZE = 5000;

export function isDuplicateWebhookMessage(messageId) {
  if (!messageId) return false;

  const now = Date.now();

  // Evict expired
  for (const [id, ts] of processedMessages.entries()) {
    if (now - ts > TTL_MS) processedMessages.delete(id);
  }

  // Hard cap
  if (processedMessages.size > MAX_SIZE) {
    const oldest = processedMessages.keys().next().value;
    processedMessages.delete(oldest);
  }

  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}