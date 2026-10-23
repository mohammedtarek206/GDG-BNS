import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { Ticket } from "@/models/Ticket";
import { EmailJob } from "@/models/EmailJob";
import { EventSettings, IEventSettings } from "@/models/EventSettings";
import { sendTicketEmail } from "@/lib/email";
import { generateQRDataUrl } from "@/lib/qr";
import { generateCampaignId } from "@/lib/utils";
import { format } from "date-fns";
import mongoose from "mongoose";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid attendee ID" }, { status: 400 });
  }

  await connectDB();

  const [attendee, settings] = await Promise.all([
    Attendee.findById(id),
    EventSettings.findOne() as Promise<IEventSettings | null>,
  ]);

  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  const ticket = await Ticket.findOne({ attendeeId: attendee._id, isRevoked: false });
  if (!ticket) return NextResponse.json({ error: "No valid ticket found – generate ticket first" }, { status: 400 });

  const qrDataUrl = await generateQRDataUrl(ticket.token);
  const ticketUrl = `${APP_URL}/ticket/${ticket.token}`;

  const { messageId, error } = await sendTicketEmail({
    to: attendee.email,
    recipientName: attendee.fullName,
    eventName: settings?.eventName ?? "GDG Event",
    eventDate: settings?.date ? format(settings.date, "EEEE, MMMM d, yyyy") : undefined,
    eventVenue: settings?.venue,
    ticketReference: ticket.token.slice(0, 12).toUpperCase(),
    qrDataUrl,
    logoUrl: settings?.logoUrl,
    supportEmail: settings?.supportEmail,
    ticketUrl,
  });

  if (error) {
    return NextResponse.json({ error: `Email failed: ${error}` }, { status: 502 });
  }

  // Create/update email job record
  const campaignId = generateCampaignId();
  await EmailJob.findOneAndUpdate(
    { attendeeId: attendee._id },
    {
      $set: {
        ticketId: ticket._id,
        recipientEmail: attendee.email,
        recipientName: attendee.fullName,
        status: "accepted",
        providerMessageId: messageId,
        lastAttemptAt: new Date(),
        campaignId,
      },
    },
    { upsert: true }
  );

  await Attendee.updateOne(
    { _id: attendee._id },
    { $set: { emailStatus: "accepted", emailSentAt: new Date(), emailMessageId: messageId } }
  );

  return NextResponse.json({ success: true, messageId });
}
