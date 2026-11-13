import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import User from '@/lib/mongodb/models/User';

// The Safari clipper signs in with a personal key made in Profile, sent as
// "Authorization: Bearer tbj_…". Only the key's hash is stored.

export function newClipKey(): { key: string; hash: string; last4: string } {
  const key = `tbj_${randomBytes(24).toString('base64url')}`;
  return { key, hash: hashKey(key), last4: key.slice(-4) };
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export async function userForKey(req: Request) {
  const m = (req.headers.get('authorization') ?? '').match(/^Bearer\s+(tbj_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  await connectDB();
  return User.findOne({ 'clipKey.hash': hashKey(m[1]) });
}

// The clipper calls from its own origin; the key is the only credential (no cookies).
export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age':       '86400',
};

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export const unauthorised = () => json({ error: 'That key isn’t valid — make a new one in Tabiji → Profile' }, 401);
