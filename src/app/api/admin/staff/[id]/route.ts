import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { StaffUser } from "@/models/StaffUser";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    await connectDB();

    const staff = await StaffUser.findById(id);
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    if (typeof body.isActive === "boolean") {
      staff.isActive = body.isActive;
    }

    await staff.save();

    await AuditLog.create({
      action: "UPDATE_STAFF",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      targetType: "StaffUser",
      targetId: id,
      details: { isActive: staff.isActive },
    });

    return NextResponse.json({ success: true, isActive: staff.isActive });
  } catch (err) {
    console.error("Staff PATCH error:", err);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid staff ID" }, { status: 400 });
  }

  try {
    await connectDB();

    const staff = await StaffUser.findByIdAndDelete(id);
    if (!staff) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    await AuditLog.create({
      action: "DELETE_STAFF",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      targetType: "StaffUser",
      targetId: id,
      details: { staffEmail: staff.email },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Staff DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete staff member" }, { status: 500 });
  }
}
