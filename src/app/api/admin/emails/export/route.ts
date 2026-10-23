import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { sanitizeForExport } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const jobs = await EmailJob.find()
      .sort({ updatedAt: -1 })
      .lean();

    const header = "Recipient Name,Recipient Email,Status,Attempts,Provider Message ID,Last Error,Updated At\n";
    const rows = jobs
      .map((j) =>
        [
          sanitizeForExport(j.recipientName),
          sanitizeForExport(j.recipientEmail),
          j.status,
          j.attempts,
          sanitizeForExport(j.providerMessageId ?? ""),
          sanitizeForExport(j.lastError ?? ""),
          j.updatedAt ? format(new Date(j.updatedAt), "yyyy-MM-dd HH:mm:ss") : "",
        ]
          .map((v) => `"${v}"`)
          .join(",")
      )
      .join("\n");

    const csv = "\uFEFF" + header + rows;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="email-report-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("Email report export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
