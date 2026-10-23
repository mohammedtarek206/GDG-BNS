import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  email?: string;
  role?: "admin" | "staff";
  name?: string;
  isLoggedIn?: boolean;
}

const secret =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
    ? process.env.SESSION_SECRET
    : "default_session_secret_at_least_32_characters_long_gdg_event";

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "gdg_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

declare module "iron-session" {
  interface IronSessionData extends SessionData {}
}
