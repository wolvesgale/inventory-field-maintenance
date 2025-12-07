import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/auth';

export async function GET(request: NextRequest) {
  const user = getSessionUserFromRequest(request);
  return NextResponse.json({ user: user ?? null });
}
