import { createHmac, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { getUserByLoginId, updateUserPassword } from '@/lib/sheets';
import type { UserSession } from '@/types';

const SESSION_COOKIE = 'app_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  user: UserSession;
  exp: number;
  nonce: string;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString();
}

function signPayload(payload: SessionPayload): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  const hmac = createHmac('sha256', SESSION_SECRET);
  hmac.update(body);
  const signature = hmac.digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const hmac = createHmac('sha256', SESSION_SECRET);
  hmac.update(body);
  const expected = hmac.digest('base64url');
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    console.error('Failed to parse session token', error);
    return null;
  }
}

export async function authenticate(loginId: string, password: string): Promise<UserSession | null> {
  const user = await getUserByLoginId(loginId.trim());
  if (!user || user.active !== true) return null;

  let passwordHash = user.password_hash?.trim();

  if (!passwordHash) {
    console.warn(`No password_hash for login_id: ${loginId}`);
    if (password !== user.login_id) {
      return null;
    }

    passwordHash = await bcrypt.hash(password, 10);
    await updateUserPassword(user.login_id, passwordHash);
  }

  const ok = await bcrypt.compare(password, passwordHash);
  if (!ok) return null;

  return {
    id: String(user.id),
    login_id: user.login_id,
    role: (user.role === 'manager' ? 'manager' : 'worker'),
    name: user.name || user.login_id,
    area: user.area,
  };
}

export function setSessionCookie(res: NextResponse, user: UserSession) {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + SESSION_TTL_MS,
    nonce: randomBytes(8).toString('hex'),
  };
  const token = signPayload(payload);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

export function getSessionUserFromRequest(req: NextRequest): UserSession | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifyToken(token);
  return payload?.user ?? null;
}

export function getSessionUserFromCookies(): UserSession | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = verifyToken(token);
  return payload?.user ?? null;
}

export function buildSessionHeaders(user: UserSession): Record<string, string> {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + SESSION_TTL_MS,
    nonce: randomBytes(8).toString('hex'),
  };
  const token = signPayload(payload);
  return { Cookie: `${SESSION_COOKIE}=${token}` };
}
