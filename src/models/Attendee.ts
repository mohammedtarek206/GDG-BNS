import mongoose, { Document, Schema } from "mongoose";

export type TicketStatus = "none" | "generated" | "revoked";
export type EmailStatus = "none" | "queued" | "sending" | "accepted" | "delivered" | "bounced" | "failed";
export type CheckInStatus = "not_checked_in" | "checked_in";

export interface IAttendee extends Document {
  // Identity
  fullName: string;
  fullNameAr?: string;
  email: string;
  phone?: string;
  organization?: string;
  registrationId?: string;

  // Import metadata
  importBatch: string;
  importedAt: Date;
  rawImportData?: Record<string, unknown>;

  // Ticket
  ticketStatus: TicketStatus;
  ticketId?: mongoose.Types.ObjectId;

  // Email
  emailStatus: EmailStatus;
  emailJobId?: mongoose.Types.ObjectId;
  emailSentAt?: Date;
  emailMessageId?: string;

  // Check-in
  checkInStatus: CheckInStatus;
  checkedInAt?: Date;
  checkedInBy?: string; // staff userId
  checkInDevice?: string;

  // Flags
  isValid: boolean;
  isRevoked: boolean;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AttendeeSchema = new Schema<IAttendee>(
  {
    fullName: { type: String, required: true, trim: true, index: true },
    fullNameAr: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    organization: { type: String, trim: true },
    registrationId: { type: String, sparse: true, unique: true, index: true },

    importBatch: { type: String, required: true, index: true },
    importedAt: { type: Date, default: Date.now },
    rawImportData: { type: Schema.Types.Mixed },

    ticketStatus: {
      type: String,
      enum: ["none", "generated", "revoked"],
      default: "none",
      index: true,
    },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },

    emailStatus: {
      type: String,
      enum: ["none", "queued", "sending", "accepted", "delivered", "bounced", "failed"],
      default: "none",
      index: true,
    },
    emailJobId: { type: Schema.Types.ObjectId, ref: "EmailJob" },
    emailSentAt: Date,
    emailMessageId: String,

    checkInStatus: {
      type: String,
      enum: ["not_checked_in", "checked_in"],
      default: "not_checked_in",
      index: true,
    },
    checkedInAt: Date,
    checkedInBy: String,
    checkInDevice: String,

    isValid: { type: Boolean, default: true, index: true },
    isRevoked: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true }
);

// Compound indexes for common queries
AttendeeSchema.index({ fullName: "text", email: "text", registrationId: "text" });
AttendeeSchema.index({ checkInStatus: 1, emailStatus: 1 });
AttendeeSchema.index({ importBatch: 1, isValid: 1 });

export const Attendee =
  mongoose.models.Attendee || mongoose.model<IAttendee>("Attendee", AttendeeSchema);
