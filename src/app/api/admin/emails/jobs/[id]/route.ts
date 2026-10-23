import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { EmailEvent } from "@/models/EmailEvent";
import { Attendee } from "@/models/Attendee";
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
    return NextResponse.json({ error: "Invalid email job ID" }, { status: 400 });
  }

  try {
    await connectDB();

    const job = await EmailJob.findById(id);
    if (!job) {
      return NextResponse.json({ error: "Email job not found" }, { status: 404 });
    }

    // 1. Delete associated email event webhooks / logs
    await EmailEvent.deleteMany({ jobId: job._id });

    // 2. If the attendee was linked, reset their emailStatus so they aren't stuck in queued/failed
    if (job.attendeeId) {
      if (["pending", "claimed", "sending", "failed", "permanently_failed"].includes(job.status)) {
        await Attendee.updateOne(
          { _id: job.attendeeId },
          { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
        );
      }
    }

    // 3. Delete the job
    await EmailJob.findByIdAndDelete(job._id);

    // 4. Audit log
    await AuditLog.create({
      action: "DELETE_EMAIL_JOB",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "EmailJob",
      targetId: String(job._id),
      details: {
        recipientEmail: job.recipientEmail,
        recipientName: job.recipientName,
        status: job.status,
        campaignId: job.campaignId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email record deleted successfully",
      deletedId: id,
    });
  } catch (err: any) {
    console.error("Delete email job error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete email record" },
      { status: 500 }
    );
  }
}
