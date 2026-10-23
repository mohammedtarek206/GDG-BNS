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
import { z } from "zod";

const BulkDeleteSchema = z.object({
  ids: z.array(z.string()).optional(),
  allMatching: z.boolean().optional(),
  filter: z
    .object({
      search: z.string().optional(),
      checkIn: z.string().optional(),
      email: z.string().optional(),
      ticketStatus: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { ids, allMatching, filter } = parsed.data;

    await connectDB();

    let targetIds: mongoose.Types.ObjectId[] = [];

    if (allMatching) {
      const query: Record<string, unknown> = { isValid: true };
      if (filter?.search) {
        query.$or = [
          { fullName: { $regex: filter.search, $options: "i" } },
          { email: { $regex: filter.search, $options: "i" } },
          { registrationId: { $regex: filter.search, $options: "i" } },
          { organization: { $regex: filter.search, $options: "i" } },
        ];
      }
      if (filter?.checkIn) query.checkInStatus = filter.checkIn;
      if (filter?.email) query.emailStatus = filter.email;
      if (filter?.ticketStatus) query.ticketStatus = filter.ticketStatus;

      const matching = await Attendee.find(query).select("_id").lean();
      targetIds = matching.map((m) => m._id as mongoose.Types.ObjectId);
    } else if (ids && ids.length > 0) {
      // Validate all IDs
      for (const id of ids) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          targetIds.push(new mongoose.Types.ObjectId(id));
        }
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "No valid attendees selected for deletion" },
        { status: 400 }
      );
    }

    // 1. Fetch targeted attendees to check how many were checked in
    const attendees = await Attendee.find({ _id: { $in: targetIds } })
      .select("_id fullName email checkInStatus")
      .lean();

    const checkedInCount = attendees.filter((a) => a.checkInStatus === "checked_in").length;
    const actualIds = attendees.map((a) => a._id);

    // 2. Find and delete email jobs and events
    const jobs = await EmailJob.find({ attendeeId: { $in: actualIds } })
      .select("_id")
      .lean();
    const jobIds = jobs.map((j) => j._id);
    if (jobIds.length > 0) {
      await EmailEvent.deleteMany({ jobId: { $in: jobIds } });
      await EmailJob.deleteMany({ attendeeId: { $in: actualIds } });
    }

    // 3. Delete tickets
    const ticketDeleteResult = await Ticket.deleteMany({ attendeeId: { $in: actualIds } });

    // 4. Update check-in logs
    await CheckInLog.updateMany(
      { attendeeId: { $in: actualIds } },
      { $set: { notes: "Attendee deleted by admin (bulk operation)" } }
    );

    // 5. Delete attendees
    const attendeeDeleteResult = await Attendee.deleteMany({ _id: { $in: actualIds } });

    // 6. Audit log
    await AuditLog.create({
      action: "BULK_DELETE_ATTENDEES",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "Attendee",
      details: {
        requestedCount: targetIds.length,
        deletedCount: attendeeDeleteResult.deletedCount,
        checkedInCount,
        ticketsDeleted: ticketDeleteResult.deletedCount,
        emailJobsDeleted: jobIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: attendeeDeleteResult.deletedCount,
      checkedInCount,
      ticketsDeleted: ticketDeleteResult.deletedCount,
      emailJobsDeleted: jobIds.length,
    });
  } catch (err: any) {
    console.error("Bulk delete attendees error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to bulk delete attendees" },
      { status: 500 }
    );
  }
}
