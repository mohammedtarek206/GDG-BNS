import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EventSettings, IEventSettings } from "@/models/EventSettings";
import { sendTicketEmail } from "@/lib/email";
import { generateQRDataUrl } from "@/lib/qr";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    await connectDB();
    const settings = (await EventSettings.findOne()) as IEventSettings | null;

    const eventName = settings?.eventName ?? "GDG DevFest 2024";
    const eventDate = settings?.date ? format(settings.date, "EEEE, MMMM d, yyyy") : undefined;
    const eventVenue = settings?.venue ?? "Grand Convention Center";
    const mockToken = "TEST-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    const qrDataUrl = await generateQRDataUrl(mockToken);
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/ticket/${mockToken}`;

    const { messageId, error } = await sendTicketEmail({
      to: email.trim().toLowerCase(),
      recipientName: "Test Attendee",
      eventName,
      eventDate,
      eventVenue,
      ticketReference: mockToken,
      qrDataUrl,
      logoUrl: settings?.logoUrl,
      supportEmail: settings?.supportEmail,
      ticketUrl,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: `Test email sent successfully to ${email}!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send test email" }, { status: 500 });
  }
}
