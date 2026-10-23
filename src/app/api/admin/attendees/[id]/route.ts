import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { Ticket } from "@/models/Ticket";
import { EmailJob } from "@/models/EmailJob";
import { EmailEvent } from "@/models/EmailEvent";
import { CheckInLog } from "@/models/CheckInLog";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
  }

  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid attendee ID" }, { status: 400 });
  }

  try {
    await connectDB();

    const attendee = await Attendee.findById(id);
    if (!attendee) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    const hadCheckedIn = attendee.checkInStatus === "checked_in";
    const attendeeId = attendee._id;

    // 1. Find all email jobs for this attendee to delete related events
    const jobs = await EmailJob.find({ attendeeId }).select("_id").lean();
    const jobIds = jobs.map((j) => j._id);
    if (jobIds.length > 0) {
      await EmailEvent.deleteMany({ jobId: { $in: jobIds } });
      await EmailJob.deleteMany({ attendeeId });
    }

    // 2. Invalidate and remove active tickets so QR codes and lookups immediately fail
    const ticketsResult = await Ticket.deleteMany({ attendeeId });

    // 3. Mark historical check-in logs as belonging to a deleted attendee
    await CheckInLog.updateMany(
      { attendeeId },
      { $set: { notes: `Attendee ${attendee.fullName} (${attendee.email}) deleted by admin` } }
    );

    // 4. Delete the attendee record
    await Attendee.findByIdAndDelete(attendeeId);

    // 5. Create audit log
    await AuditLog.create({
      action: "DELETE_ATTENDEE",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "Attendee",
      targetId: String(attendeeId),
      details: {
        fullName: attendee.fullName,
        email: attendee.email,
        registrationId: attendee.registrationId,
        hadCheckedIn,
        ticketsDeleted: ticketsResult.deletedCount,
        emailJobsDeleted: jobIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Attendee and related records deleted successfully",
      hadCheckedIn,
      deletedId: id,
    });
  } catch (err: any) {
    console.error("Delete attendee error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete attendee" },
      { status: 500 }
    );
  }
}
