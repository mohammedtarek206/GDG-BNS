import mongoose, { Document, Schema } from "mongoose";

export interface IEventSettings extends Document {
  eventName: string;
  eventNameAr: string;
  description: string;
  descriptionAr: string;
  date?: Date;
  endDate?: Date;
  venue: string;
  venueAr: string;
  logoUrl?: string;
  bannerUrl?: string;
  supportEmail: string;
  supportPhone?: string;
  websiteUrl?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  timezone: string;
  language: "en" | "ar" | "both";
  createdAt: Date;
  updatedAt: Date;
}

const EventSettingsSchema = new Schema<IEventSettings>(
  {
    eventName: { type: String, default: "[Event Name – Configure in Settings]" },
    eventNameAr: { type: String, default: "[اسم الحدث – يُضبط في الإعدادات]" },
    description: { type: String, default: "" },
    descriptionAr: { type: String, default: "" },
    date: { type: Date },
    endDate: { type: Date },
    venue: { type: String, default: "[Venue – Configure in Settings]" },
    venueAr: { type: String, default: "[المكان – يُضبط في الإعدادات]" },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    supportEmail: { type: String, default: "support@example.com" },
    supportPhone: { type: String },
    websiteUrl: { type: String },
    socialLinks: {
      twitter: String,
      linkedin: String,
      instagram: String,
      youtube: String,
    },
    timezone: { type: String, default: "Africa/Cairo" },
    language: { type: String, enum: ["en", "ar", "both"], default: "both" },
  },
  { timestamps: true }
);

export const EventSettings =
  mongoose.models.EventSettings ||
  mongoose.model<IEventSettings>("EventSettings", EventSettingsSchema);
