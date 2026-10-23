import mongoose, { Document, Schema } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  performedBy: string; // userId or "system"
  performedByRole: "admin" | "staff" | "system";
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    performedBy: { type: String, required: true, index: true },
    performedByRole: {
      type: String,
      enum: ["admin", "staff", "system"],
      required: true,
    },
    targetType: String,
    targetId: String,
    details: Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
