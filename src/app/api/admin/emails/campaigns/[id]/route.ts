import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { EmailEvent } from "@/models/EmailEvent";
import { Attendee } from "@/models/Attendee";
import { AuditLog } from "@/models/AuditLog";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
  }

  const { id: campaignId } = params;
  if (!campaignId) {
    return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
  }

  try {
    await connectDB();

    // 1. Find all jobs in this campaign
    const jobs = await EmailJob.find({ campaignId }).select("_id attendeeId status").lean();
    if (jobs.length === 0) {
      return NextResponse.json({ error: "Campaign not found or has no jobs" }, { status: 404 });
    }

    const jobIds = jobs.map((j) => j._id);
    const attendeeIds = jobs.map((j) => j.attendeeId).filter(Boolean);

    // 2. Delete related email event logs
    await EmailEvent.deleteMany({ jobId: { $in: jobIds } });

    // 3. Reset affected attendees' emailStatus to 'none' and unset emailJobId
    let affectedAttendees = 0;
    if (attendeeIds.length > 0) {
      const resetResult = await Attendee.updateMany(
        { _id: { $in: attendeeIds } },
        { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
      );
      affectedAttendees = resetResult.modifiedCount;
    }

    // 4. Delete all email jobs in the campaign
    const deleteResult = await EmailJob.deleteMany({ campaignId });

    // 5. Audit log
    await AuditLog.create({
      action: "DELETE_CAMPAIGN",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "Campaign",
      targetId: campaignId,
      details: {
        campaignId,
        deletedJobsCount: deleteResult.deletedCount,
        affectedAttendees,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Campaign ${campaignId} deleted successfully`,
      deletedJobsCount: deleteResult.deletedCount,
      affectedAttendees,
    });
  } catch (err: any) {
    console.error("Delete campaign error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
