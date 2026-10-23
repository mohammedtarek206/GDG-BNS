import mongoose, { Document, Schema } from "mongoose";

export interface IEmailEvent extends Document {
  jobId: mongoose.Types.ObjectId;
  providerMessageId: string;
  eventType: string; // e.g. "email.delivered", "email.bounced"
  eventData: Record<string, unknown>;
  processedAt: Date;
  svixDeliveryId?: string; // deduplicate webhook events
  createdAt: Date;
}

const EmailEventSchema = new Schema<IEmailEvent>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "EmailJob", required: true, index: true },
    providerMessageId: { type: String, required: true, index: true },
    eventType: { type: String, required: true },
    eventData: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date, default: Date.now },
    svixDeliveryId: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

export const EmailEvent =
  mongoose.models.EmailEvent || mongoose.model<IEmailEvent>("EmailEvent", EmailEventSchema);
