import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { Ticket } from "@/models/Ticket";
import { AuditLog } from "@/models/AuditLog";
import { generateTicketToken, hashToken } from "@/lib/utils";

// Bulk generate tickets for all attendees without one
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    // Find all valid attendees without a generated ticket
    const unticketedAttendees = await Attendee.find({
      isValid: true,
      ticketStatus: "none",
    }).select("_id fullName email");

    if (unticketedAttendees.length === 0) {
      return NextResponse.json({ generated: 0, message: "All attendees already have tickets" });
    }

    let generated = 0;
    let failed = 0;

    for (const attendee of unticketedAttendees) {
      try {
        const token = generateTicketToken();
        const tokenHash = hashToken(token);

        const ticket = await Ticket.create({
          attendeeId: attendee._id,
          token,
          tokenHash,
          generatedBy: session.userId ?? "system",
          generatedAt: new Date(),
        });

        await Attendee.updateOne(
          { _id: attendee._id },
          {
            $set: {
              ticketStatus: "generated",
              ticketId: ticket._id,
            },
          }
        );

        generated++;
      } catch {
        failed++;
      }
    }

    await AuditLog.create({
      action: "BULK_GENERATE_TICKETS",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      details: { generated, failed, total: unticketedAttendees.length },
    });

    return NextResponse.json({ generated, failed, total: unticketedAttendees.length });
  } catch (err) {
    console.error("Generate tickets error:", err);
    return NextResponse.json({ error: "Failed to generate tickets" }, { status: 500 });
  }
}

// Get ticket stats
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const [total, generated, revoked, attendeesWithoutTicket] = await Promise.all([
    Attendee.countDocuments({ isValid: true }),
    Ticket.countDocuments({ isRevoked: false }),
    Ticket.countDocuments({ isRevoked: true }),
    Attendee.countDocuments({ isValid: true, ticketStatus: "none" }),
  ]);

  return NextResponse.json({ total, generated, revoked, attendeesWithoutTicket });
}
