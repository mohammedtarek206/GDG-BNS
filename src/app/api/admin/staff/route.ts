import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { StaffUser } from "@/models/StaffUser";
import { AuditLog } from "@/models/AuditLog";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateStaffSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(100),
  password: z.string().min(6).max(100),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const staff = await StaffUser.find()
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ staff: JSON.parse(JSON.stringify(staff)) });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = CreateStaffSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid staff details", details: result.error.errors }, { status: 400 });
    }

    const { name, email, password } = result.data;

    await connectDB();

    const existing = await StaffUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "A staff account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newStaff = await StaffUser.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "staff",
      isActive: true,
    });

    await AuditLog.create({
      action: "CREATE_STAFF",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      targetType: "StaffUser",
      targetId: String(newStaff._id),
      details: { staffEmail: email, staffName: name },
    });

    return NextResponse.json({
      success: true,
      staff: {
        _id: newStaff._id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        isActive: newStaff.isActive,
      },
    });
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
  }
}
