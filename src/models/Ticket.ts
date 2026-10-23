import mongoose, { Document, Schema } from "mongoose";

export interface ITicket extends Document {
  attendeeId: mongoose.Types.ObjectId;
  // Public token embedded in QR code – random, not guessable
  token: string;
  // SHA-256 hash of token stored for comparison
  tokenHash: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
  // Replacement ticket when revoked
  replacedBy?: mongoose.Types.ObjectId;
  generatedAt: Date;
  generatedBy: string; // "system" or admin userId
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    attendeeId: {
      type: Schema.Types.ObjectId,
      ref: "Attendee",
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    isRevoked: { type: Boolean, default: false, index: true },
    revokedAt: Date,
    revokedBy: String,
    revokeReason: String,
    replacedBy: { type: Schema.Types.ObjectId, ref: "Ticket" },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

export const Ticket =
  mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
