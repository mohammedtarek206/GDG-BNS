import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EventSettings } from "@/models/EventSettings";
import { AuditLog } from "@/models/AuditLog";
import { z } from "zod";

const SettingsSchema = z.object({
  eventName: z.string().min(1).max(200),
  eventNameAr: z.string().min(1).max(200),
  description: z.string().optional().default(""),
  descriptionAr: z.string().optional().default(""),
  date: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  venue: z.string().min(1).max(200),
  venueAr: z.string().min(1).max(200),
  logoUrl: z.string().optional().default(""),
  bannerUrl: z.string().optional().default(""),
  supportEmail: z.string().email(),
  supportPhone: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
  timezone: z.string().default("Africa/Cairo"),
  language: z.enum(["en", "ar", "both"]).default("both"),
  socialLinks: z
    .object({
      twitter: z.string().optional().default(""),
      linkedin: z.string().optional().default(""),
      instagram: z.string().optional().default(""),
      youtube: z.string().optional().default(""),
    })
    .optional(),
});

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  let settings = await EventSettings.findOne().lean();
  if (!settings) {
    settings = await EventSettings.create({
      eventName: "GDG DevFest 2024",
      eventNameAr: "ديف فيست مجتمع مطوري جوجل 2024",
      description: "Annual premier developer conference by Google Developer Groups",
      descriptionAr: "المؤتمر السنوي الأكبر لمجتمعات مطوري جوجل",
      venue: "Main Conference Hall",
      venueAr: "القاعة الرئيسية للمؤتمرات",
      supportEmail: "support@gdg.community",
      timezone: "Africa/Cairo",
      language: "both",
    });
  }

  return NextResponse.json({ settings: JSON.parse(JSON.stringify(settings)) });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = SettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.errors }, { status: 400 });
    }

    await connectDB();

    const data = result.data;
    const updatePayload: Record<string, unknown> = {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    };

    const settings = await EventSettings.findOneAndUpdate(
      {},
      { $set: updatePayload },
      { new: true, upsert: true }
    );

    await AuditLog.create({
      action: "UPDATE_SETTINGS",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      details: { eventName: data.eventName },
    });

    return NextResponse.json({ success: true, settings: JSON.parse(JSON.stringify(settings)) });
  } catch (err) {
    console.error("Settings PUT error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
