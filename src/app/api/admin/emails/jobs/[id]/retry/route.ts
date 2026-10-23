import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { Attendee } from "@/models/Attendee";
import mongoose from "mongoose";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  try {
    await connectDB();

    const job = await EmailJob.findById(id);
    if (!job) return NextResponse.json({ error: "Email job not found" }, { status: 404 });

    job.status = "pending";
    job.attempts = 0;
    job.nextRetryAt = undefined;
    job.lastError = undefined;
    await job.save();

    await Attendee.updateOne(
      { _id: job.attendeeId },
      { $set: { emailStatus: "queued" } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Retry single job error:", err);
    return NextResponse.json({ error: "Failed to retry email job" }, { status: 500 });
  }
}
