import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const campaignId = searchParams.get("campaignId")?.trim() ?? "";

    await connectDB();

    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { recipientName: { $regex: search, $options: "i" } },
        { recipientEmail: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      if (status === "failed") {
        query.status = { $in: ["failed", "permanently_failed", "bounced"] };
      } else {
        query.status = status;
      }
    }

    if (campaignId) {
      query.campaignId = campaignId;
    }

    const [jobs, total] = await Promise.all([
      EmailJob.find(query).sort({ updatedAt: -1 }).limit(200).lean(),
      EmailJob.countDocuments(query),
    ]);

    return NextResponse.json({
      jobs: JSON.parse(JSON.stringify(jobs)),
      total,
    });
  } catch (err) {
    console.error("Email jobs GET error:", err);
    return NextResponse.json({ error: "Failed to fetch email jobs" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaignId");

    await connectDB();
    const query: Record<string, unknown> = {};

    if (campaignId) {
      query.campaignId = campaignId;
    } else if (status) {
      if (status === "failed") query.status = { $in: ["failed", "permanently_failed", "bounced"] };
      else if (status === "pending") query.status = { $in: ["pending", "claimed"] };
      else if (status === "delivered") query.status = { $in: ["accepted", "delivered"] };
      else if (status !== "all") query.status = status;
    } else {
      return NextResponse.json({ error: "Specify status or campaignId" }, { status: 400 });
    }

    const jobs = await EmailJob.find(query).select("_id attendeeId status").lean();
    if (jobs.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const jobIds = jobs.map((j) => j._id);
    const pendingAttendeeIds = jobs
      .filter((j) => ["pending", "claimed", "sending", "failed", "permanently_failed"].includes(j.status) && j.attendeeId)
      .map((j) => j.attendeeId);

    const { EmailEvent } = await import("@/models/EmailEvent");
    const { Attendee } = await import("@/models/Attendee");
    const { AuditLog } = await import("@/models/AuditLog");

    await EmailEvent.deleteMany({ jobId: { $in: jobIds } });

    if (pendingAttendeeIds.length > 0) {
      await Attendee.updateMany(
        { _id: { $in: pendingAttendeeIds } },
        { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
      );
    }

    const del = await EmailJob.deleteMany({ _id: { $in: jobIds } });

    await AuditLog.create({
      action: "DELETE_EMAIL_JOBS_QUERY",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "EmailJob",
      details: { query, deletedCount: del.deletedCount },
    });

    return NextResponse.json({ success: true, deletedCount: del.deletedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete jobs" }, { status: 500 });
  }
}
