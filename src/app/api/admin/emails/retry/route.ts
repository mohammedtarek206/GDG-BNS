import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { Attendee } from "@/models/Attendee";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const result = await EmailJob.updateMany(
      { status: { $in: ["failed", "permanently_failed", "bounced"] } },
      {
        $set: {
          status: "pending",
          attempts: 0,
        },
        $unset: { nextRetryAt: "", lastError: "" },
      }
    );

    // Also update attendee statuses
    await Attendee.updateMany(
      { emailStatus: { $in: ["failed", "bounced"] } },
      { $set: { emailStatus: "queued" } }
    );

    return NextResponse.json({ retried: result.modifiedCount });
  } catch (err) {
    console.error("Retry all failed emails error:", err);
    return NextResponse.json({ error: "Failed to retry emails" }, { status: 500 });
  }
}
