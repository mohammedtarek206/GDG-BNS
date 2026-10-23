"use client";
import { useState, useEffect } from "react";
import { QrCode, RefreshCw, CheckCircle, AlertTriangle, Download, Send } from "lucide-react";
import toast from "react-hot-toast";

interface TicketStats {
  total: number;
  generated: number;
  revoked: number;
  attendeesWithoutTicket: number;
}

export default function TicketsPage() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ generated: number; failed: number } | null>(null);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets/generate");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStats(); }, []);

  async function handleBulkGenerate() {
    if ((stats?.attendeesWithoutTicket ?? 0) === 0) {
      toast("All attendees already have tickets!", { icon: "✅" });
      return;
    }
    if (!confirm(`Generate tickets for ${stats?.attendeesWithoutTicket} attendees?`)) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/tickets/generate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast.success(`Generated ${data.generated} tickets!`);
        fetchStats();
      } else {
        toast.error(data.error || "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">QR Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and manage attendee QR code tickets</p>
        </div>
        <button onClick={fetchStats} className="btn-secondary">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Attendees", value: stats?.total ?? "—", color: "bg-gdg-blue" },
          { label: "Tickets Generated", value: stats?.generated ?? "—", color: "bg-gdg-green" },
          { label: "Revoked Tickets", value: stats?.revoked ?? "—", color: "bg-gdg-red" },
          { label: "Pending Tickets", value: stats?.attendeesWithoutTicket ?? "—", color: "bg-gdg-yellow" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5 text-center">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mx-auto mb-3`}>
              <QrCode size={20} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-gdg-navy">{loading ? "—" : value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Bulk Generate Card */}
      <div className="card p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <QrCode size={32} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gdg-navy">Bulk QR Ticket Generation</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate unique QR code tickets for all attendees who don&apos;t have one yet.
              This operation is safe to run multiple times – existing tickets are never overwritten.
            </p>
            {stats && stats.attendeesWithoutTicket > 0 && (
              <div className="flex items-center gap-2 mt-2 text-amber-600">
                <AlertTriangle size={14} />
                <span className="text-sm font-medium">
                  {stats.attendeesWithoutTicket} attendees need tickets
                </span>
              </div>
            )}
            {stats && stats.attendeesWithoutTicket === 0 && (
              <div className="flex items-center gap-2 mt-2 text-green-600">
                <CheckCircle size={14} />
                <span className="text-sm font-medium">All attendees have tickets</span>
              </div>
            )}
          </div>
          <button
            onClick={handleBulkGenerate}
            disabled={generating || loading}
            className="btn-primary flex-shrink-0"
          >
            {generating ? (
              <><RefreshCw size={16} className="animate-spin" />Generating...</>
            ) : (
              <><QrCode size={16} />Generate Tickets</>
            )}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
            <p className="text-sm font-medium text-green-800">
              ✅ Generated <strong>{result.generated}</strong> new tickets.
              {result.failed > 0 && <span className="text-red-600 ml-2">⚠️ {result.failed} failed.</span>}
            </p>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: "🔐",
            title: "Cryptographically Secure",
            desc: "Each ticket token is generated using 32 bytes of cryptographic randomness – impossible to guess or forge.",
          },
          {
            icon: "🙈",
            title: "Privacy-First",
            desc: "QR codes never contain personal data. They encode only a secure random token that validates server-side.",
          },
          {
            icon: "🔁",
            title: "Idempotent Generation",
            desc: "Running bulk generation multiple times is safe – existing tickets are preserved and never invalidated.",
          },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="card p-5">
            <div className="text-2xl mb-3">{icon}</div>
            <h3 className="font-semibold text-gdg-navy text-sm mb-1">{title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Next Steps */}
      <div className="card p-6 mt-6 border-gdg-blue/20 bg-blue-50/50">
        <h3 className="font-semibold text-gdg-navy mb-3 flex items-center gap-2">
          <Send size={16} className="text-gdg-blue" />
          Next Steps
        </h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gdg-blue text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            Generate tickets above for all attendees
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gdg-blue text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            Go to <a href="/admin/emails" className="text-gdg-blue hover:underline">Email Manager</a> to send tickets to all attendees
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-gdg-blue text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            On event day, use the <a href="/admin/checkin" className="text-gdg-blue hover:underline">QR Scanner</a> to check in attendees
          </li>
        </ol>
      </div>
    </div>
  );
}
