"use client";
import { useState } from "react";
import { Search, Ticket, ArrowRight, Shield, ScanLine, Calendar, MapPin, CheckCircle, Sparkles, Phone, MessageCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface HomeClientProps {
  eventName: string;
  eventNameAr: string;
  description: string;
  descriptionAr: string;
  venue: string;
  venueAr: string;
  eventDate?: string;
  supportEmail: string;
}

export function HomeClient({
  eventName,
  eventNameAr,
  description,
  descriptionAr,
  venue,
  venueAr,
  eventDate,
  supportEmail,
}: HomeClientProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ ticketUrl: string; attendeeName: string } | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setResult(null);

    try {
      const res = await fetch("/api/ticket/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(`Found ticket for ${data.attendeeName}!`);
      } else {
        toast.error(data.error || "Ticket not found");
      }
    } catch {
      toast.error("Network error looking up ticket");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white selection:bg-gdg-blue selection:text-white flex flex-col justify-between">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-red-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 rounded-full bg-green-600/15 blur-[120px]" />
      </div>

      <div>
        {/* Top Navbar */}
        <header className="relative border-b border-white/10 backdrop-blur-md bg-slate-900/60 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC05]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
              </div>
              <span className="font-bold text-lg tracking-tight">GDG Event</span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/admin/checkin"
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                <ScanLine size={14} className="text-gdg-green" />
                Scanner
              </Link>
              <Link
                href="/admin/login"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5"
              >
                <Shield size={14} className="text-gdg-blue" />
                Staff / Admin Portal
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
          {/* GDG Tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-blue-200 font-medium mb-8">
            <Sparkles size={14} className="text-gdg-yellow" />
            Google Developer Groups Event Platform
          </div>

          {/* Event Title */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            {eventName}
          </h1>
          {eventNameAr && (
            <p className="text-xl sm:text-2xl text-gray-300 font-arabic mb-6" dir="rtl">
              {eventNameAr}
            </p>
          )}

          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {description || "Welcome to our premier developer event. Scan your ticket at the entrance for quick and seamless check-in."}
          </p>

          {/* Date & Location Pill Cards */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            {eventDate && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
                <Calendar size={16} className="text-gdg-blue" />
                <span>{eventDate}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300">
              <MapPin size={16} className="text-gdg-green" />
              <span>{venue}</span>
            </div>
          </div>

          {/* Find My Ticket Box */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-2xl text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gdg-blue/20 text-gdg-blue flex items-center justify-center">
                <Ticket size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Find Your Ticket</h2>
                <p className="text-xs text-gray-400">
                  Search by registered email, phone number, or registration ID
                </p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-3">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Email, phone (e.g. 01284621015), or REG-12345"
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gdg-blue transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="w-full py-3 bg-gdg-blue hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {searching ? (
                  <>Searching...</>
                ) : (
                  <>
                    Find My Entry Pass
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Result Card */}
            {result && (
              <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 animate-fade-in flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle size={14} /> Pass Found!
                  </p>
                  <p className="text-sm font-bold text-white mt-0.5">{result.attendeeName}</p>
                </div>
                <Link
                  href={result.ticketUrl}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors inline-flex items-center gap-1"
                >
                  Open Ticket →
                </Link>
              </div>
            )}
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-16 text-left">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                <Ticket size={16} />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Instant QR Tickets</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Every attendee receives a cryptographically secure digital QR pass accessible online anytime.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center mb-3">
                <ScanLine size={16} />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Fast Mobile Check-in</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Staff scan tickets with any smartphone camera for sub-second verification and duplicate detection.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center mb-3">
                <Shield size={16} />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Live Analytics</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Real-time attendance rates, check-in flow monitoring, and instant email delivery statistics.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Professional Footer - Developed by Mohamed Tarek */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5 text-center md:text-left">
            <div className="flex gap-1.5 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC05]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">
                Designed &amp; Developed by <span className="text-[#4285F4] font-bold">Mohamed Tarek</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Full-Stack Event Management &amp; Secure QR Ticketing Platform
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:+201284621015"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white transition-all shadow-sm group"
            >
              <Phone size={14} className="text-[#4285F4] group-hover:scale-110 transition-transform" />
              <span>+20 128 462 1015</span>
            </a>
            <a
              href="https://wa.me/201284621015"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm group"
            >
              <MessageCircle size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>WhatsApp Chat</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
