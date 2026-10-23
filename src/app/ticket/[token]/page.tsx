import { connectDB } from "@/lib/db";
import { Ticket, ITicket } from "@/models/Ticket";
import { Attendee, IAttendee } from "@/models/Attendee";
import { EventSettings, IEventSettings } from "@/models/EventSettings";
import { hashToken } from "@/lib/utils";
import { generateQRDataUrl } from "@/lib/qr";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, MapPin, Calendar, Building2, User, Mail, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { TicketActions } from "./TicketClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  return {
    title: "Event Ticket | GDG Platform",
    description: "Official digital ticket for Google Developer Groups event",
  };
}

export default async function TicketPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  await connectDB();

  const tokenHash = hashToken(token);
  const ticket = (await Ticket.findOne({ tokenHash })) as ITicket | null;

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gdg-navy mb-2">Ticket Not Found</h1>
          <p className="text-sm text-gray-500 mb-6">
            This ticket link is invalid or does not exist in our system. Please ensure you have opened the exact link received in your confirmation email.
          </p>
          <a href="/" className="btn-primary justify-center w-full">
            Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  const [attendee, settings] = await Promise.all([
    Attendee.findById(ticket.attendeeId) as Promise<IAttendee | null>,
    EventSettings.findOne() as Promise<IEventSettings | null>,
  ]);

  if (!attendee) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <p className="text-gray-500">Attendee record not found.</p>
        </div>
      </div>
    );
  }

  const qrDataUrl = await generateQRDataUrl(token);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const ticketUrl = `${APP_URL}/ticket/${token}`;

  const eventName = settings?.eventName ?? "GDG DevFest 2024";
  const eventNameAr = settings?.eventNameAr ?? "ديف فيست مجتمع مطوري جوجل 2024";
  const venue = settings?.venue ?? "Main Venue Hall";
  const venueAr = settings?.venueAr ?? "القاعة الرئيسية";
  const formattedDate = settings?.date ? format(new Date(settings.date), "EEEE, MMMM d, yyyy") : undefined;
  const formattedTime = settings?.date ? format(new Date(settings.date), "hh:mm a") : undefined;

  const isCheckedIn = attendee.checkInStatus === "checked_in";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-10 px-4 sm:px-6">
      <div className="max-w-md mx-auto">
        {/* GDG Top Colors Bar */}
        <div className="flex h-1.5 rounded-t-2xl overflow-hidden shadow-sm">
          <div className="flex-1 bg-[#4285F4]" />
          <div className="flex-1 bg-[#EA4335]" />
          <div className="flex-1 bg-[#FBBC05]" />
          <div className="flex-1 bg-[#34A853]" />
        </div>

        {/* Ticket Container */}
        <div className="bg-white rounded-b-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-gdg-navy to-slate-900 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs text-blue-200 font-medium mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Official Entry Pass
            </div>
            <h1 className="text-xl font-bold tracking-tight">{eventName}</h1>
            {eventNameAr && (
              <p className="text-xs text-gray-300 mt-0.5 font-arabic" dir="rtl">
                {eventNameAr}
              </p>
            )}
          </div>

          {/* Revoked Notice */}
          {ticket.isRevoked ? (
            <div className="p-6 bg-red-50 border-b border-red-100 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-lg font-bold text-red-700">Ticket Revoked</h2>
              <p className="text-xs text-red-600 mt-1">
                {ticket.revokeReason || "This ticket has been cancelled or replaced."}
              </p>
            </div>
          ) : (
            <>
              {/* Check-in Status Banner */}
              <div
                className={`py-2.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 ${
                  isCheckedIn
                    ? "bg-green-500 text-white"
                    : "bg-blue-50 text-blue-700 border-b border-blue-100"
                }`}
              >
                {isCheckedIn ? (
                  <>
                    <CheckCircle2 size={15} />
                    Checked In at{" "}
                    {attendee.checkedInAt
                      ? format(new Date(attendee.checkedInAt), "hh:mm a")
                      : "Entrance"}
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Valid Ticket · Present at Entry Door
                  </>
                )}
              </div>

              {/* Attendee Details */}
              <div className="p-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Attendee Name
                    </span>
                    <h2 className="text-lg font-bold text-gdg-navy mt-0.5">
                      {attendee.fullName}
                    </h2>
                  </div>
                  {attendee.registrationId && (
                    <div className="text-right">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                        Reg ID
                      </span>
                      <p className="font-mono text-xs font-bold text-gdg-blue mt-0.5">
                        {attendee.registrationId}
                      </p>
                    </div>
                  )}
                </div>

                {attendee.organization && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                    <Building2 size={12} className="text-gray-400" />
                    {attendee.organization}
                  </p>
                )}
              </div>

              {/* QR Code Section */}
              <div className="p-6 text-center bg-slate-50/70 border-b border-gray-100 relative">
                {/* Perforation Cutouts */}
                <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-200" />
                <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-200" />

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 inline-block">
                  <img
                    src={qrDataUrl}
                    alt="Ticket QR Code"
                    className="w-56 h-56 mx-auto block"
                  />
                </div>
                <p className="text-[11px] text-gray-400 font-mono mt-3">
                  PASS CODE: {ticket.token.slice(0, 16).toUpperCase()}
                </p>
              </div>

              {/* Event Time & Location Details */}
              <div className="p-6 space-y-3.5 text-sm">
                {formattedDate && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-gdg-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <p className="font-semibold text-gdg-navy text-xs">Date & Time</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formattedDate} {formattedTime ? `· ${formattedTime}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 text-gdg-green flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-gdg-navy text-xs">Location</p>
                    <p className="text-xs text-gray-500 mt-0.5">{venue}</p>
                    {venueAr && (
                      <p className="text-[11px] text-gray-400 font-arabic" dir="rtl">
                        {venueAr}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="px-6 pb-6">
                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
                  💡 <strong>Important:</strong> Keep your screen brightness high when presenting this ticket for scanning at the registration desk.
                </div>
              </div>
            </>
          )}

          {/* Footer Support */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center text-xs text-gray-400">
            Need help? Contact{" "}
            <a
              href={`mailto:${settings?.supportEmail ?? "support@gdg.community"}`}
              className="text-gdg-blue hover:underline"
            >
              {settings?.supportEmail ?? "support@gdg.community"}
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        {!ticket.isRevoked && (
          <div className="mt-6">
            <TicketActions
              eventName={eventName}
              eventDate={formattedDate}
              venue={venue}
              ticketUrl={ticketUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
