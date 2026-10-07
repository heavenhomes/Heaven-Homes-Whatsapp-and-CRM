import dbConnect, { isDbConnected } from '@/lib/mongodb';
import TeamMember from '@/lib/models/TeamMember';
import { logActivity } from '@/lib/activity/log';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth/session';

export async function POST(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const member = await TeamMember.findOne({ username });
    if (!member) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (member.active === false) {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 401 });
    }

    // Support both new (passwordHash) and legacy (password) fields.
    // Once everyone is migrated, drop the legacy branch.
    let ok = false;
    if (member.passwordHash) {
      ok = await bcrypt.compare(password, member.passwordHash);
    } else if (member.password) {
      ok = password === member.password;
    }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = createSessionToken({
      sub: String(member._id),
      username: member.username,
      name: member.name,
      role: member.role,
    });

    const res = NextResponse.json({
      success: true,
      data: {
        _id: member._id,
        name: member.name,
        username: member.username,
        role: member.role,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    await logActivity(request, {
  actorType: member.role,
  actorId: member._id,
  actorName: member.name,
  actorUsername: member.username,
  action: 'auth.login',
  category: 'auth',
  description: `${member.name} (${member.role === 'owner' ? 'Owner' : 'Channel Partner'}) logged in`,
  targetType: 'TeamMember',
  targetId: member._id,
  targetLabel: member.username,
  severity: 'info',
});


    return res;
  } catch (error) {
    console.error('[auth/login] error:', error);
    return NextResponse.json({ error: 'Login failed', message: error.message }, { status: 500 });
  }
  
}