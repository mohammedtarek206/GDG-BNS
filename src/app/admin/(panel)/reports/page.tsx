"use client";
import { useState, useEffect } from "react";
import { BarChart2, Download, RefreshCw, Users, CheckCircle, Ticket, Mail, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import toast from "react-hot-toast";

interface ReportsData {
  totalAttendees: number;
  checkedIn: number;
  attendanceRate: number;
  totalTickets: number;
  hourlyCheckIns: Array<{ hour: string; count: number }>;
  topOrganizations: Array<{ name: string; attendees: number }>;
  emailFunnel: {
    pending: number;
    accepted: number;
    delivered: number;
    bounced: number;
    failed: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function exportAttendees() {
    window.open("/api/admin/attendees/export", "_blank");
  }

  async function exportEmails() {
    window.open("/api/admin/emails/export", "_blank");
  }

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart2 size={24} className="text-gdg-blue" />
            Event Analytics & Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Comprehensive check-in timeline, attendee demographics, and email conversion
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAttendees} className="btn-secondary">
            <Download size={16} />
            Export Attendees
          </button>
          <button onClick={exportEmails} className="btn-secondary">
            <Download size={16} />
            Export Email Log
          </button>
          <button onClick={fetchReports} className="btn-secondary">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <Users size={20} className="text-gdg-blue" />
          </div>
          <p className="text-2xl font-bold text-gdg-navy">{data?.totalAttendees ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Registered Attendees</p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
            <CheckCircle size={20} className="text-gdg-green" />
          </div>
          <p className="text-2xl font-bold text-gdg-navy">{data?.checkedIn ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Checked In ({data ? `${data.attendanceRate}%` : "—"})
          </p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
            <Ticket size={20} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gdg-navy">{data?.totalTickets ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">Active QR Tickets</p>
        </div>
        <div className="card p-5">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center mb-3">
            <Mail size={20} className="text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gdg-navy">
            {data ? data.emailFunnel.delivered + data.emailFunnel.accepted : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Emails Successfully Delivered</p>
        </div>
      </div>

      {/* Hourly Check-In Timeline */}
      <div className="card p-6 mb-8">
        <h2 className="section-title flex items-center gap-2">
          <TrendingUp size={18} className="text-gdg-green" />
          Check-in Traffic by Hour
        </h2>
        {data && data.hourlyCheckIns.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.hourlyCheckIns}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Bar dataKey="count" fill="#34A853" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No check-in logs recorded yet</p>
          </div>
        )}
      </div>

      {/* Demographics & Email Funnel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Organizations */}
        <div className="card p-6">
          <h2 className="section-title">Top Organizations / Universities</h2>
          {data && data.topOrganizations.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topOrganizations} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Bar dataKey="attendees" fill="#4285F4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Users size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No organization data available</p>
            </div>
          )}
        </div>

        {/* Email Funnel Breakdown */}
        <div className="card p-6">
          <h2 className="section-title">Email Delivery Breakdown</h2>
          {data ? (
            <div className="space-y-4 pt-2">
              {[
                { label: "Delivered (Inbox confirmed)", count: data.emailFunnel.delivered, color: "bg-green-500", text: "text-green-700" },
                { label: "Accepted (Provider received)", count: data.emailFunnel.accepted, color: "bg-blue-500", text: "text-blue-700" },
                { label: "Pending in Queue", count: data.emailFunnel.pending, color: "bg-gray-400", text: "text-gray-600" },
                { label: "Bounced", count: data.emailFunnel.bounced, color: "bg-yellow-500", text: "text-yellow-700" },
                { label: "Failed", count: data.emailFunnel.failed, color: "bg-red-500", text: "text-red-700" },
              ].map(({ label, count, color, text }) => {
                const total = Math.max(1, (data.emailFunnel.delivered + data.emailFunnel.accepted + data.emailFunnel.pending + data.emailFunnel.bounced + data.emailFunnel.failed));
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-gray-600">{label}</span>
                      <span className={text}>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">Loading email breakdown...</div>
          )}
        </div>
      </div>
    </div>
  );
}
