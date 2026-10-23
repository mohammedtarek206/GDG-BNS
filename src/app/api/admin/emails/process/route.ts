import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";
import { Ticket, ITicket } from "@/models/Ticket";
import { Attendee } from "@/models/Attendee";
import { EventSettings, IEventSettings } from "@/models/EventSettings";
import { sendTicketEmail } from "@/lib/email";
import { generateQRDataUrl } from "@/lib/qr";
import { backoffDelay } from "@/lib/utils";
import { format } from "date-fns";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const now = new Date();

    // Find jobs that are pending or retryable
    const jobs = await EmailJob.find({
      $or: [
        { status: "pending" },
        { status: "failed", nextRetryAt: { $lte: now } },
      ],
    })
      .limit(BATCH_SIZE)
      .lean();

    if (jobs.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: "No pending email jobs" });
    }

    const settings = (await EventSettings.findOne()) as IEventSettings | null;
    const eventName = settings?.eventName ?? "GDG Event";
    const eventDate = settings?.date ? format(settings.date, "EEEE, MMMM d, yyyy") : undefined;
    const eventVenue = settings?.venue;
    const logoUrl = settings?.logoUrl;
    const supportEmail = settings?.supportEmail;

    let sent = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        // Atomically claim the job to prevent race conditions with deletion or concurrent workers
        const claimed = await EmailJob.findOneAndUpdate(
          { _id: job._id, status: { $in: ["pending", "failed"] } },
          { $set: { status: "sending", lastAttemptAt: new Date() } },
          { new: true }
        );
        if (!claimed) {
          // Job was deleted or claimed concurrently
          continue;
        }

        // Verify attendee exists and is active
        const attendee = await Attendee.findById(job.attendeeId);
        if (!attendee || !attendee.isValid || attendee.isRevoked) {
          await EmailJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: "permanently_failed",
                lastError: "Attendee was deleted or revoked",
                lastAttemptAt: new Date(),
              },
            }
          );
          failed++;
          continue;
        }

        const ticket = (await Ticket.findById(job.ticketId)) as ITicket | null;
        if (!ticket || ticket.isRevoked) {
          await EmailJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: "permanently_failed",
                lastError: "Ticket not found or revoked",
                lastAttemptAt: new Date(),
              },
            }
          );
          failed++;
          continue;
        }

        const qrDataUrl = await generateQRDataUrl(ticket.token);
        const ticketUrl = `${APP_URL}/ticket/${ticket.token}`;

        const { messageId, error } = await sendTicketEmail({
          to: job.recipientEmail,
          recipientName: job.recipientName,
          eventName,
          eventDate,
          eventVenue,
          ticketReference: ticket.token.slice(0, 12).toUpperCase(),
          qrDataUrl,
          logoUrl,
          supportEmail,
          ticketUrl,
        });

        if (error) {
          const attempts = (job.attempts ?? 0) + 1;
          const maxAttempts = job.maxAttempts ?? 3;
          const isPerm = attempts >= maxAttempts;
          const delay = backoffDelay(attempts);
          const nextRetryAt = new Date(Date.now() + delay);

          await Promise.all([
            EmailJob.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: isPerm ? "permanently_failed" : "failed",
                  attempts,
                  lastAttemptAt: new Date(),
                  nextRetryAt: isPerm ? undefined : nextRetryAt,
                  lastError: error,
                },
              }
            ),
            Attendee.updateOne(
              { _id: job.attendeeId },
              { $set: { emailStatus: isPerm ? "failed" : "none" } }
            ),
          ]);

          failed++;
        } else {
          await Promise.all([
            EmailJob.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: "accepted",
                  providerMessageId: messageId,
                  attempts: (job.attempts ?? 0) + 1,
                  lastAttemptAt: new Date(),
                  lastError: undefined,
                },
                $unset: { nextRetryAt: "" },
              }
            ),
            Attendee.updateOne(
              { _id: job.attendeeId },
              {
                $set: {
                  emailStatus: "accepted",
                  emailSentAt: new Date(),
                  emailMessageId: messageId,
                },
              }
            ),
          ]);

          sent++;
        }
      } catch (err) {
        console.error(`Error sending email job ${job._id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, totalProcessed: jobs.length });
  } catch (err) {
    console.error("Process batch error:", err);
    return NextResponse.json({ error: "Failed to process email batch" }, { status: 500 });
  }
}
