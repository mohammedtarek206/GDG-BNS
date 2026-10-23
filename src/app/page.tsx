import { connectDB } from "@/lib/db";
import { EventSettings, IEventSettings } from "@/models/EventSettings";
import { format } from "date-fns";
import { HomeClient } from "./HomeClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GDG Event Platform | Entry & Check-in",
  description: "Official event management, digital tickets, and QR check-in platform for Google Developer Groups",
};

export default async function HomePage() {
  let settings: IEventSettings | null = null;
  try {
    await connectDB();
    settings = (await EventSettings.findOne()) as IEventSettings | null;
  } catch (err) {
    console.warn("Could not connect to database on HomePage, using defaults:", err);
  }

  const eventName = settings?.eventName ?? "GDG DevFest 2024";
  const eventNameAr = settings?.eventNameAr ?? "ديف فيست مجتمع مطوري جوجل 2024";
  const description = settings?.description ?? "Premier developer gathering featuring sessions on Cloud, AI/ML, Web, and Mobile technologies.";
  const descriptionAr = settings?.descriptionAr ?? "المؤتمر السنوي الأكبر لمجتمعات مطوري جوجل لتطوير البرمجيات والذكاء الاصطناعي والحوسبة السحابية.";
  const venue = settings?.venue ?? "Convention Hall";
  const venueAr = settings?.venueAr ?? "قاعة المؤتمرات";
  const eventDate = settings?.date ? format(new Date(settings.date), "MMMM d, yyyy · h:mm a") : undefined;
  const supportEmail = settings?.supportEmail ?? "support@gdg.community";

  return (
    <HomeClient
      eventName={eventName}
      eventNameAr={eventNameAr}
      description={description}
      descriptionAr={descriptionAr}
      venue={venue}
      venueAr={venueAr}
      eventDate={eventDate}
      supportEmail={supportEmail}
    />
  );
}
