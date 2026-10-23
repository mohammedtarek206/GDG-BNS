import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { EmailEvent } from "@/models/EmailEvent";
import { Attendee } from "@/models/Attendee";
import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";
import { z } from "zod";

const BulkDeleteJobsSchema = z.object({
  jobIds: z.array(z.string()).optional(),
  status: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BulkDeleteJobsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { jobIds, status, campaignId } = parsed.data;

    await connectDB();

    const query: Record<string, unknown> = {};

    if (jobIds && jobIds.length > 0) {
      const validIds = jobIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (validIds.length === 0) {
        return NextResponse.json({ error: "No valid job IDs provided" }, { status: 400 });
      }
      query._id = { $in: validIds };
    } else if (campaignId) {
      query.campaignId = campaignId;
    } else if (status) {
      if (status === "failed") {
        query.status = { $in: ["failed", "permanently_failed", "bounced"] };
      } else if (status === "pending") {
        query.status = { $in: ["pending", "claimed"] };
      } else if (status === "delivered" || status === "accepted") {
        query.status = { $in: ["accepted", "delivered"] };
      } else if (status === "all") {
        // delete all jobs
      } else {
        query.status = status;
      }
    } else {
      return NextResponse.json(
        { error: "Must provide jobIds, status, or campaignId to delete" },
        { status: 400 }
      );
    }

    // 1. Fetch targeted jobs to collect attendeeIds and jobIds
    const jobs = await EmailJob.find(query).select("_id attendeeId status").lean();
    if (jobs.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0, message: "No matching jobs found" });
    }

    const targetJobIds = jobs.map((j) => j._id);
    const pendingOrFailedAttendeeIds = jobs
      .filter((j) => ["pending", "claimed", "sending", "failed", "permanently_failed"].includes(j.status) && j.attendeeId)
      .map((j) => j.attendeeId);

    // 2. Delete all related email event logs
    await EmailEvent.deleteMany({ jobId: { $in: targetJobIds } });

    // 3. Reset affected attendees' emailStatus so they aren't stuck
    let affectedAttendees = 0;
    if (pendingOrFailedAttendeeIds.length > 0) {
      const resetResult = await Attendee.updateMany(
        { _id: { $in: pendingOrFailedAttendeeIds } },
        { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
      );
      affectedAttendees = resetResult.modifiedCount;
    }

    // 4. Delete the jobs
    const deleteResult = await EmailJob.deleteMany({ _id: { $in: targetJobIds } });

    // 5. Audit log
    await AuditLog.create({
      action: "BULK_DELETE_EMAIL_JOBS",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "EmailJob",
      details: {
        filter: { status, campaignId, selectedCount: jobIds?.length },
        deletedCount: deleteResult.deletedCount,
        affectedAttendees,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      affectedAttendees,
    });
  } catch (err: any) {
    console.error("Bulk delete email jobs error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to bulk delete email records" },
      { status: 500 }
    );
  }
}
