import mongoose, { Document, Schema } from "mongoose";

export type EmailJobStatus =
  | "pending"
  | "claimed"
  | "sending"
  | "accepted"
  | "delivered"
  | "bounced"
  | "failed"
  | "permanently_failed";

export interface IEmailJob extends Document {
  attendeeId: mongoose.Types.ObjectId;
  ticketId: mongoose.Types.ObjectId;
  recipientEmail: string;
  recipientName: string;
  status: EmailJobStatus;

  // Resend provider tracking
  providerMessageId?: string;

  // Retry management
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  lastError?: string;
  errorDetails?: Record<string, unknown>;

  // Lease for atomic claiming
  claimedAt?: Date;
  claimedBy?: string;
  leaseDuration: number; // seconds

  // Campaign batch
  campaignId: string;

  createdAt: Date;
  updatedAt: Date;
}

const EmailJobSchema = new Schema<IEmailJob>(
  {
    attendeeId: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      required: true,
      index: true,
    },
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
    },
    recipientEmail: { type: String, required: true, index: true },
    recipientName: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "claimed",
        "sending",
        "accepted",
        "delivered",
        "bounced",
        "failed",
        "permanently_failed",
      ],
      default: "pending",
      index: true,
    },
    providerMessageId: { type: String, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastAttemptAt: Date,
    nextRetryAt: { type: Date, index: true },
    lastError: String,
    errorDetails: Schema.Types.Mixed,
    claimedAt: Date,
    claimedBy: String,
    leaseDuration: { type: Number, default: 300 },
    campaignId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// For finding retryable jobs
EmailJobSchema.index({ status: 1, nextRetryAt: 1 });
// For detecting expired leases
EmailJobSchema.index({ status: 1, claimedAt: 1 });

export const EmailJob =
  mongoose.models.EmailJob || mongoose.model<IEmailJob>("EmailJob", EmailJobSchema);
