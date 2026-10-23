import { NextRequest, NextResponse } from "next/server";
import { requireStaffOrAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { CheckInLog } from "@/models/CheckInLog";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireStaffOrAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid attendee ID" }, { status: 400 });
    }

    await connectDB();

    const attendee = await Attendee.findById(id);
    if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

    if (attendee.checkInStatus === "checked_in") {
      return NextResponse.json({
        error: "Already checked in",
        checkedInAt: attendee.checkedInAt,
      }, { status: 409 });
    }

    // Atomic update
    const updated = await Attendee.findOneAndUpdate(
      { _id: id, checkInStatus: "not_checked_in" },
      {
        $set: {
          checkInStatus: "checked_in",
          checkedInAt: new Date(),
          checkedInBy: session.userId,
          checkInDevice: "admin-manual",
        },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Check-in failed (race condition)" }, { status: 409 });
    }

    await Promise.all([
      CheckInLog.create({
        attendeeId: attendee._id,
        outcome: "success",
        staffId: session.userId,
        staffName: session.name,
        deviceInfo: "admin-manual",
        checkedInAt: new Date(),
        notes: "Manual check-in by admin",
      }),
      AuditLog.create({
        action: "MANUAL_CHECKIN",
        performedBy: session.userId ?? "unknown",
        performedByRole: "admin",
        targetType: "Attendee",
        targetId: id,
        details: { attendeeName: attendee.fullName, attendeeEmail: attendee.email },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Manual check-in error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
