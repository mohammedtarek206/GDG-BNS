"use client";
import { Printer, Calendar, Share2, Check, Download } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface TicketClientProps {
  eventName: string;
  eventDate?: string;
  venue?: string;
  ticketUrl: string;
}

export function TicketActions({ eventName, eventDate, venue, ticketUrl }: TicketClientProps) {
  const [copied, setCopied] = useState(false);

  function handlePrint() {
    window.print();
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: `My Ticket – ${eventName}`,
        text: `Here is my ticket for ${eventName}`,
        url: ticketUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(ticketUrl);
      setCopied(true);
      toast.success("Ticket link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    }
  }

  // Google Calendar URL generator
  function getGoogleCalendarUrl() {
    const title = encodeURIComponent(eventName);
    const location = encodeURIComponent(venue ?? "");
    const details = encodeURIComponent(`Ticket link: ${ticketUrl}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&location=${location}&details=${details}`;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 no-print">
      <button onClick={handlePrint} className="btn-primary">
        <Printer size={16} />
        Print / Save as PDF
      </button>

      <a
        href={getGoogleCalendarUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary"
      >
        <Calendar size={16} />
        Add to Google Calendar
      </a>

      <button onClick={handleShare} className="btn-secondary">
        {copied ? <Check size={16} className="text-green-600" /> : <Share2 size={16} />}
        {copied ? "Copied!" : "Share Link"}
      </button>
    </div>
  );
}
