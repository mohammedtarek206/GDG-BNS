import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  checkIn: z.string().optional(),
  email: z.string().optional(),
  ticketStatus: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const params = QuerySchema.parse(Object.fromEntries(searchParams));

    await connectDB();

    const query: Record<string, unknown> = { isValid: true };

    if (params.search) {
      query.$or = [
        { fullName: { $regex: params.search, $options: "i" } },
        { email: { $regex: params.search, $options: "i" } },
        { registrationId: { $regex: params.search, $options: "i" } },
        { organization: { $regex: params.search, $options: "i" } },
      ];
    }

    if (params.checkIn) query.checkInStatus = params.checkIn;
    if (params.email) query.emailStatus = params.email;
    if (params.ticketStatus) query.ticketStatus = params.ticketStatus;

    const skip = (params.page - 1) * params.pageSize;

    const [attendees, total] = await Promise.all([
      Attendee.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(params.pageSize)
        .select("-rawImportData")
        .lean(),
      Attendee.countDocuments(query),
    ]);

    return NextResponse.json({
      attendees: JSON.parse(JSON.stringify(attendees)),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    });
  } catch (err) {
    console.error("Attendees GET error:", err);
    return NextResponse.json({ error: "Failed to fetch attendees" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = body.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No attendee IDs provided" }, { status: 400 });
    }

    const { Ticket } = await import("@/models/Ticket");
    const { EmailJob } = await import("@/models/EmailJob");
    const { EmailEvent } = await import("@/models/EmailEvent");
    const { CheckInLog } = await import("@/models/CheckInLog");
    const { AuditLog } = await import("@/models/AuditLog");
    const mongoose = (await import("mongoose")).default;

    await connectDB();

    const validIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validIds.length === 0) {
      return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
    }

    const attendees = await Attendee.find({ _id: { $in: validIds } }).select("_id fullName email checkInStatus").lean();
    const actualIds = attendees.map((a) => a._id);
    const checkedInCount = attendees.filter((a) => a.checkInStatus === "checked_in").length;

    const jobs = await EmailJob.find({ attendeeId: { $in: actualIds } }).select("_id").lean();
    const jobIds = jobs.map((j) => j._id);
    if (jobIds.length > 0) {
      await EmailEvent.deleteMany({ jobId: { $in: jobIds } });
      await EmailJob.deleteMany({ attendeeId: { $in: actualIds } });
    }

    const ticketRes = await Ticket.deleteMany({ attendeeId: { $in: actualIds } });
    await CheckInLog.updateMany({ attendeeId: { $in: actualIds } }, { $set: { notes: "Attendee deleted by admin" } });
    const delRes = await Attendee.deleteMany({ _id: { $in: actualIds } });

    await AuditLog.create({
      action: "BULK_DELETE_ATTENDEES",
      performedBy: session.userId || "admin",
      performedByRole: "admin",
      targetType: "Attendee",
      details: { deletedCount: delRes.deletedCount, checkedInCount, ticketsDeleted: ticketRes.deletedCount },
    });

    return NextResponse.json({
      success: true,
      deletedCount: delRes.deletedCount,
      checkedInCount,
      ticketsDeleted: ticketRes.deletedCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete attendees" }, { status: 500 });
  }
}

