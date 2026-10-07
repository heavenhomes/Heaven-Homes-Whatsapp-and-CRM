import { NextResponse } from 'next/server';
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(token);

  if (!payload) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      _id: payload.sub,
      name: payload.name,
      username: payload.username,
      role: payload.role,
    },
  });
}