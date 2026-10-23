import { NextRequest, NextResponse } from "next/server";
import { requireStaffOrAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Ticket, ITicket } from "@/models/Ticket";
import { Attendee, IAttendee } from "@/models/Attendee";
import { CheckInLog } from "@/models/CheckInLog";
import { hashToken } from "@/lib/utils";
import { z } from "zod";

const ValidateSchema = z.object({
  token: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await requireStaffOrAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = ValidateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ outcome: "invalid", message: "Invalid request" }, { status: 400 });
    }

    let { token } = result.data;

    // Extract token from URL if a full URL was submitted
    try {
      const url = new URL(token);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        token = parts[parts.length - 1];
      }
    } catch {
      /* not a URL, use as-is */
    }

    await connectDB();

    // Use hash for lookup – never store raw token in DB
    const tokenHash = hashToken(token);
    const ticket = (await Ticket.findOne({ tokenHash })) as ITicket | null;

    if (!ticket) {
      await CheckInLog.create({
        token,
        outcome: "invalid",
        staffId: session.userId,
        staffName: session.name,
        deviceInfo: req.headers.get("user-agent") ?? undefined,
        ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
        checkedInAt: new Date(),
      });
      return NextResponse.json({
        outcome: "invalid",
        message: "Ticket not found in system",
      });
    }

    if (ticket.isRevoked) {
      await CheckInLog.create({
        ticketId: ticket._id,
        attendeeId: ticket.attendeeId,
        token,
        outcome: "revoked",
        staffId: session.userId,
        staffName: session.name,
        checkedInAt: new Date(),
      });
      return NextResponse.json({ outcome: "revoked", message: "This ticket has been revoked" });
    }

    const attendee = await Attendee.findById(ticket.attendeeId);
    if (!attendee || !attendee.isValid || attendee.isRevoked) {
      return NextResponse.json({ outcome: "invalid", message: "Attendee record not found or revoked" });
    }

    if (attendee.checkInStatus === "checked_in") {
      await CheckInLog.create({
        ticketId: ticket._id,
        attendeeId: attendee._id,
        token,
        outcome: "already_checked_in",
        staffId: session.userId,
        staffName: session.name,
        checkedInAt: new Date(),
      });
      return NextResponse.json({
        outcome: "already_checked_in",
        attendeeName: attendee.fullName,
        checkedInAt: attendee.checkedInAt,
        message: "This attendee is already checked in",
      });
    }

    // Atomic check-in: only update if still not checked in
    const now = new Date();
    const updated = await Attendee.findOneAndUpdate(
      { _id: attendee._id, checkInStatus: "not_checked_in" },
      {
        $set: {
          checkInStatus: "checked_in",
          checkedInAt: now,
          checkedInBy: session.userId,
          checkInDevice: req.headers.get("user-agent")?.slice(0, 200),
        },
      },
      { new: true }
    );

    if (!updated) {
      // Was checked in by another concurrent request
      const refreshed = (await Attendee.findById(attendee._id)) as IAttendee | null;
      return NextResponse.json({
        outcome: "already_checked_in",
        attendeeName: attendee.fullName,
        checkedInAt: refreshed?.checkedInAt,
        message: "Already checked in concurrently",
      });
    }

    await CheckInLog.create({
      ticketId: ticket._id,
      attendeeId: attendee._id,
      token,
      outcome: "success",
      staffId: session.userId,
      staffName: session.name,
      deviceInfo: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      checkedInAt: now,
    });

    return NextResponse.json({
      outcome: "success",
      attendeeName: attendee.fullName,
      message: "Welcome! Checked in successfully.",
    });
  } catch (err) {
    console.error("Check-in validate error:", err);
    return NextResponse.json({ outcome: "error", message: "Server error – please retry" }, { status: 500 });
  }
}
