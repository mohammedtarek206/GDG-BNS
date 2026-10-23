import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AuditLog } from "@/models/AuditLog";
import { connectDB } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (session.isLoggedIn && session.userId) {
      await connectDB();
      await AuditLog.create({
        action: "LOGOUT",
        performedBy: session.userId,
        performedByRole: session.role ?? "admin",
      });
    }
    session.destroy();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
