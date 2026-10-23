import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { AdminUser } from "@/models/AdminUser";
import { StaffUser } from "@/models/StaffUser";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { rateLimit } from "@/lib/auth";
import { AuditLog } from "@/models/AuditLog";

const LoginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.ip ?? "unknown";

    // Rate limit: 5 attempts per 15 minutes per IP
    if (!rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = result.data;
    await connectDB();

    // Check admin first, then staff
    let user: { _id: unknown; email: string; name: string; role: string; isActive: boolean; lockUntil?: Date; loginAttempts?: number; comparePassword: (p: string) => Promise<boolean> } | null = null;
    let role: "admin" | "staff" = "admin";

    const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });
    if (adminUser) {
      user = adminUser;
      role = "admin";
    } else {
      const staffUser = await StaffUser.findOne({ email: email.toLowerCase() });
      if (staffUser) {
        user = staffUser;
        role = "staff";
      }
    }

    if (!user || !user.isActive) {
      // Avoid timing attacks – still compare a dummy
      await bcrypt.compare(password, "$2b$10$dummyhashfordummycomparison000000");
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Check account lock
    if (user.lockUntil && user.lockUntil > new Date()) {
      return NextResponse.json(
        { error: "Account temporarily locked. Please try again later." },
        { status: 423 }
      );
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      // Increment failed attempts
      if (role === "admin") {
        const attempts = (user.loginAttempts ?? 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined;
        await AdminUser.updateOne(
          { _id: user._id },
          { $inc: { loginAttempts: 1 }, ...(lockUntil ? { $set: { lockUntil } } : {}) }
        );
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Reset attempts on success
    if (role === "admin") {
      await AdminUser.updateOne(
        { _id: user._id },
        { $set: { loginAttempts: 0, lastLogin: new Date() }, $unset: { lockUntil: "" } }
      );
    } else {
      await StaffUser.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Create session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = String(user._id);
    session.email = user.email;
    session.name = user.name;
    session.role = role;
    session.isLoggedIn = true;
    await session.save();

    // Audit log
    await AuditLog.create({
      action: "LOGIN",
      performedBy: String(user._id),
      performedByRole: role,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, role });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
