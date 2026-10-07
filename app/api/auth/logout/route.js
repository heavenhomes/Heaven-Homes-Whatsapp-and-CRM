import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { logActivity } from '@/lib/activity/log';

export async function POST(request) {
  // Capture the user BEFORE we clear the cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);

  if (payload) {
    await logActivity(request, {
      actorType: payload.role,
      actorId: payload.sub,
      actorName: payload.name,
      actorUsername: payload.username,
      action: 'auth.logout',
      category: 'auth',
      description: `${payload.name} logged out`,
      targetType: 'TeamMember',
      targetId: payload.sub,
      targetLabel: payload.username,
      severity: 'info',
    });
  }

  const res = NextResponse.json({ success: true, message: 'Logged out' });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}