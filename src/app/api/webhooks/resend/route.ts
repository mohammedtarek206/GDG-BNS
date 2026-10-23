import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { connectDB } from "@/lib/db";
import { EmailEvent } from "@/models/EmailEvent";
import { EmailJob } from "@/models/EmailJob";
import { Attendee } from "@/models/Attendee";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    const headersList = req.headers;

    const svixId = headersList.get("svix-id");
    const svixTimestamp = headersList.get("svix-timestamp");
    const svixSignature = headersList.get("svix-signature");

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify webhook signature if secret configured
    if (webhookSecret && svixId && svixTimestamp && svixSignature) {
      try {
        const wh = new Webhook(webhookSecret);
        wh.verify(payload, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const event = JSON.parse(payload);
    const { type, data } = event;
    const emailId = data?.email_id;

    if (!emailId) {
      return NextResponse.json({ received: true });
    }

    await connectDB();

    // Idempotency check via svixId
    if (svixId) {
      const existing = await EmailEvent.findOne({ svixDeliveryId: svixId });
      if (existing) {
        return NextResponse.json({ received: true, message: "Duplicate event skipped" });
      }
    }

    const job = await EmailJob.findOne({ providerMessageId: emailId });
    if (!job) {
      return NextResponse.json({ received: true, message: "No matching job found" });
    }

    let jobStatus: string | null = null;
    let attendeeStatus: string | null = null;

    if (type === "email.delivered") {
      jobStatus = "delivered";
      attendeeStatus = "delivered";
    } else if (type === "email.bounced") {
      jobStatus = "bounced";
      attendeeStatus = "bounced";
    } else if (type === "email.complained") {
      jobStatus = "failed";
      attendeeStatus = "failed";
    }

    if (jobStatus) {
      await EmailJob.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
    }

    if (attendeeStatus) {
      await Attendee.updateOne({ _id: job.attendeeId }, { $set: { emailStatus: attendeeStatus } });
    }

    await EmailEvent.create({
      jobId: job._id,
      providerMessageId: emailId,
      eventType: type,
      eventData: data,
      processedAt: new Date(),
      svixDeliveryId: svixId || undefined,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
