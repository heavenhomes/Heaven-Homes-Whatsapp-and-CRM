// lib/auth/session.js
import crypto from 'crypto';

const SESSION_COOKIE = 'hh_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Signing secret — put AUTH_SECRET in your .env.local
// e.g. AUTH_SECRET=some-long-random-string-here
function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Add AUTH_SECRET=<random-32+ chars> to .env.local'
    );
  }
  return s;
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function sign(payload) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest();
}

/**
 * Create a signed session token.
 * Payload: { sub, username, name, role, exp }
 */
export function createSessionToken(payload) {
  const body = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const json = JSON.stringify(body);
  const encoded = base64url(json);
  const signature = base64url(sign(encoded));
  return `${encoded}.${signature}`;
}

/**
 * Verify and decode a signed session token.
 * Returns payload or null if invalid/expired.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = base64url(sign(encoded));
  // Constant-time compare
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(encoded).toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_MS / 1000, // seconds
};