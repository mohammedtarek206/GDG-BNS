import mongoose, { Document, Schema } from "mongoose";

export interface ICheckInLog extends Document {
  ticketId: mongoose.Types.ObjectId;
  attendeeId: mongoose.Types.ObjectId;
  token: string;
  outcome: "success" | "already_checked_in" | "invalid" | "revoked" | "error";
  staffId?: string;
  staffName?: string;
  deviceInfo?: string;
  ipAddress?: string;
  checkedInAt: Date;
  notes?: string;
  createdAt: Date;
}

const CheckInLogSchema = new Schema<ICheckInLog>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", index: true },
    attendeeId: { type: Schema.Types.ObjectId, ref: "Attendee", index: true },
    token: { type: String, index: true },
    outcome: {
      type: String,
      enum: ["success", "already_checked_in", "invalid", "revoked", "error"],
      required: true,
      index: true,
    },
    staffId: String,
    staffName: String,
    deviceInfo: String,
    ipAddress: String,
    checkedInAt: { type: Date, default: Date.now, index: true },
    notes: String,
  },
  { timestamps: true }
);

export const CheckInLog =
  mongoose.models.CheckInLog || mongoose.model<ICheckInLog>("CheckInLog", CheckInLogSchema);
