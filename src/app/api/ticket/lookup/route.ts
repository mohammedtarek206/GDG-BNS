import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { Ticket } from "@/models/Ticket";
import { rateLimit } from "@/lib/auth";
import { z } from "zod";

const LookupSchema = z.object({
  query: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";

    // Rate limit: 15 lookups per 5 minutes per IP
    if (!rateLimit(`lookup:${ip}`, 15, 5 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many lookups. Please wait a moment." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const result = LookupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Please enter a valid email, phone number, or registration ID" }, { status: 400 });
    }

    const { query } = result.data;
    const cleanQuery = query.trim().toLowerCase();
    const digitsOnly = query.replace(/\D/g, "");

    await connectDB();

    const orConditions: Array<Record<string, unknown>> = [
      { email: cleanQuery },
      { registrationId: cleanQuery },
      { phone: query.trim() },
    ];

    // If query has at least 7 digits, search phone by core digits (e.g. 01284621015 matches +201284621015)
    if (digitsOnly.length >= 7) {
      const coreDigits = digitsOnly.slice(-9);
      orConditions.push({ phone: { $regex: coreDigits } });
    }

    const attendee = await Attendee.findOne({
      isValid: true,
      $or: orConditions,
    });

    if (!attendee) {
      return NextResponse.json(
        { error: "No attendee found matching this email, phone number, or registration ID." },
        { status: 404 }
      );
    }

    const ticket = await Ticket.findOne({ attendeeId: attendee._id, isRevoked: false });
    if (!ticket) {
      return NextResponse.json(
        { error: "Attendee found, but ticket has not been generated yet. Please contact the organizers." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ticketUrl: `/ticket/${ticket.token}`,
      attendeeName: attendee.fullName,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
