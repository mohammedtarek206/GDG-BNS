import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sessionOptions, SessionData } from "./session";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAdmin(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return null;
  }
  return session;
}

export async function requireStaffOrAdmin(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !["admin", "staff"].includes(session.role ?? "")) {
    return null;
  }
  return session;
}

// Rate limiting: simple in-memory map (replace with Redis or Upstash in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxRequests) return false; // blocked

  entry.count++;
  return true; // allowed
}
