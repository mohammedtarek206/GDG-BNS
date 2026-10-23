import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IStaffUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "staff";
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const StaffUserSchema = new Schema<IStaffUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "staff", enum: ["staff"] },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

StaffUserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const StaffUser =
  mongoose.models.StaffUser || mongoose.model<IStaffUser>("StaffUser", StaffUserSchema);
