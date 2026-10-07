import dbConnect, { isDbConnected } from '@/lib/mongodb';
import TeamMember from '@/lib/models/TeamMember';
import { encryptPassword } from '@/lib/auth/password-crypto';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { decryptPassword } from '@/lib/auth/password-crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeMember(m, { revealPassword = false } = {}) {
  const base = {
    _id: m._id,
    name: m.name,
    role: m.role,
    username: m.username,
    active: m.active,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
  if (revealPassword) {
    base.password = decryptPassword(m.passwordEnc || '');
  }
  return base;
}

// ---------- GET ----------
export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const skip = (page - 1) * limit;

 const query = {};
if (search) {
  const re = { $regex: escapeRegex(search), $options: 'i' };
  query.$or = [{ name: re }, { username: re }, { role: re }];
}

// New: filter by role (e.g. role=channel_partner)
const role = searchParams.get('role');
if (role) query.role = role;

// New: filter by active (default: include all)
const activeParam = searchParams.get('active');
if (activeParam === 'true') query.active = true;
else if (activeParam === 'false') query.active = false;

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
const session = verifySessionToken(token);
const isOwner = session?.role === 'owner';

const [members, total] = await Promise.all([
  TeamMember.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  TeamMember.countDocuments(query),
]);

return NextResponse.json({
  success: true,
  data: members.map((m) => safeMember(m, { revealPassword: isOwner })),
  pagination: { total, page, limit, pages: Math.ceil(total / limit) },
});
  } catch (error) {
    console.error('[team-members] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members', message: error.message },
      { status: 500 }
    );
  }
}

// ---------- POST ----------
export async function POST(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const body = await request.json();
    const name = (body.name || '').trim();
    const username = (body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();
    const role = body.role;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }
    if (!['owner', 'channel_partner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const existing = await TeamMember.findOne({ username });
    if (existing) {
      return NextResponse.json(
        { error: `Username "${username}" is already taken` },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const passwordEnc = encryptPassword(password);

    const member = await TeamMember.create({
      name,
      username,
      role,
      passwordHash,
      passwordEnc,
      password: '',
       // never store plaintext on new records
    });

    return NextResponse.json(
      { success: true, data: safeMember(member), message: 'Team member created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[team-members] POST error:', error);
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Duplicate username' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create team member', message: error.message },
      { status: 500 }
    );
  }
}