// lib/auth/password-crypto.js
import crypto from 'crypto';

// Reuse AUTH_SECRET (must already be set — session.js enforces it)
function getKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET missing or too short');
  }
  // Derive a 32-byte key from the secret
  return crypto.createHash('sha256').update(s).digest();
}

// AES-256-GCM encrypt → "iv:tag:ciphertext" (all base64)
export function encryptPassword(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptPassword(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) return '';
  try {
    const [ivB64, tagB64, encB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('[password-crypto] decrypt failed:', err.message);
    return '';
  }
}