import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { sanitizeForExport } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const checkIn = searchParams.get("checkIn") ?? "";
    const emailStatus = searchParams.get("email") ?? "";

    await connectDB();

    const query: Record<string, unknown> = { isValid: true };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (checkIn) query.checkInStatus = checkIn;
    if (emailStatus) query.emailStatus = emailStatus;

    const attendees = await Attendee.find(query)
      .sort({ fullName: 1 })
      .select("fullName email phone organization registrationId ticketStatus emailStatus checkInStatus checkedInAt")
      .lean();

    const header = "Full Name,Email,Phone,Organization,Registration ID,Ticket Status,Email Status,Check-in Status,Checked In At\n";
    const rows = attendees
      .map((a) =>
        [
          sanitizeForExport(a.fullName),
          sanitizeForExport(a.email),
          sanitizeForExport(a.phone ?? ""),
          sanitizeForExport(a.organization ?? ""),
          sanitizeForExport(a.registrationId ?? ""),
          a.ticketStatus,
          a.emailStatus,
          a.checkInStatus,
          a.checkedInAt ? format(new Date(a.checkedInAt), "yyyy-MM-dd HH:mm:ss") : "",
        ]
          .map((v) => `"${v}"`)
          .join(",")
      )
      .join("\n");

    const csv = "\uFEFF" + header + rows; // BOM for Excel UTF-8

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendees-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
