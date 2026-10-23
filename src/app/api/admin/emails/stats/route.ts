import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const [total, pending, sending, accepted, delivered, bounced, failed, permanentlyFailed] =
    await Promise.all([
      EmailJob.countDocuments({}),
      EmailJob.countDocuments({ status: "pending" }),
      EmailJob.countDocuments({ status: { $in: ["claimed", "sending"] } }),
      EmailJob.countDocuments({ status: "accepted" }),
      EmailJob.countDocuments({ status: "delivered" }),
      EmailJob.countDocuments({ status: "bounced" }),
      EmailJob.countDocuments({ status: "failed" }),
      EmailJob.countDocuments({ status: "permanently_failed" }),
    ]);

  return NextResponse.json({
    total,
    pending,
    sending,
    accepted,
    delivered,
    bounced,
    failed,
    permanentlyFailed,
  });
}
