import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { Ticket } from "@/models/Ticket";
import { EmailJob } from "@/models/EmailJob";
import { AuditLog } from "@/models/AuditLog";
import { generateCampaignId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    // Find all attendees with generated ticket who are not already queued/sent/delivered
    const attendees = await Attendee.find({
      isValid: true,
      ticketStatus: "generated",
      emailStatus: { $in: ["none", "failed"] },
    }).select("_id fullName email ticketId");

    if (attendees.length === 0) {
      return NextResponse.json({ queued: 0, message: "No attendees eligible for email queuing" });
    }

    const campaignId = generateCampaignId();
    let queued = 0;

    for (const attendee of attendees) {
      let ticketId = attendee.ticketId;
      if (!ticketId) {
        const ticket = await Ticket.findOne({ attendeeId: attendee._id, isRevoked: false });
        if (ticket) ticketId = ticket._id;
      }

      if (!ticketId) continue;

      // Upsert email job
      const job = await EmailJob.findOneAndUpdate(
        { attendeeId: attendee._id },
        {
          $set: {
            ticketId,
            recipientEmail: attendee.email,
            recipientName: attendee.fullName,
            status: "pending",
            campaignId,
            attempts: 0,
            lastError: undefined,
          },
          $unset: { nextRetryAt: "" },
        },
        { upsert: true, new: true }
      );

      await Attendee.updateOne(
        { _id: attendee._id },
        { $set: { emailStatus: "queued", emailJobId: job._id } }
      );

      queued++;
    }

    await AuditLog.create({
      action: "QUEUE_EMAILS",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      details: { queued, campaignId, totalFound: attendees.length },
    });

    return NextResponse.json({ queued, campaignId });
  } catch (err) {
    console.error("Queue emails error:", err);
    return NextResponse.json({ error: "Failed to queue emails" }, { status: 500 });
  }
}
