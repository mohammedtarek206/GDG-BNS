"use client";
import { useState, useCallback } from "react";
import {
  Users, QrCode, Mail, CheckCircle, XCircle, TrendingUp,
  Clock, AlertTriangle, RefreshCw, MailCheck, MailX, Send
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

interface DashboardStats {
  totalAttendees: number;
  ticketsGenerated: number;
  emailsAccepted: number;
  emailsDelivered: number;
  emailsBounced: number;
  emailsFailed: number;
  emailPending: number;
  checkedIn: number;
  notCheckedIn: number;
  checkInPercentage: number;
  recentCheckIns: Array<{ attendeeId: string; staffName?: string; checkedInAt: string; _id: string }>;
  recentEmailErrors: Array<{ recipientEmail: string; lastError?: string; updatedAt: string; _id: string }>;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  trend?: number;
}

function StatCard({ title, value, icon: Icon, color, subtext, trend }: StatCardProps) {
  return (
    <div className="card p-5 flex items-start gap-4 hover:shadow-card-hover transition-all duration-200">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-gdg-navy mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        {typeof trend === "number" && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
            <TrendingUp size={12} className={trend < 0 ? "rotate-180" : ""} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardClient({ stats }: { stats: DashboardStats }) {
  const [refreshing, setRefreshing] = useState(false);
  const [currentStats, setCurrentStats] = useState(stats);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setCurrentStats(data);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const emailChartData = [
    { name: "Pending", value: currentStats.emailPending, color: "#94a3b8" },
    { name: "Accepted", value: currentStats.emailsAccepted, color: "#4285F4" },
    { name: "Delivered", value: currentStats.emailsDelivered, color: "#34A853" },
    { name: "Bounced", value: currentStats.emailsBounced, color: "#FBBC05" },
    { name: "Failed", value: currentStats.emailsFailed, color: "#EA4335" },
  ];

  const checkInData = [
    { name: "Checked In", value: currentStats.checkedIn },
    { name: "Not Yet", value: currentStats.notCheckedIn },
  ];

  const COLORS = ["#34A853", "#e2e8f0"];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Live event statistics and activity</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Attendees"
          value={currentStats.totalAttendees.toLocaleString()}
          icon={Users}
          color="bg-gdg-blue"
        />
        <StatCard
          title="Tickets Generated"
          value={currentStats.ticketsGenerated.toLocaleString()}
          icon={QrCode}
          color="bg-purple-500"
          subtext={`${currentStats.totalAttendees - currentStats.ticketsGenerated} pending`}
        />
        <StatCard
          title="Checked In"
          value={`${currentStats.checkedIn} / ${currentStats.totalAttendees}`}
          icon={CheckCircle}
          color="bg-gdg-green"
          subtext={`${currentStats.checkInPercentage}% attendance rate`}
        />
        <StatCard
          title="Emails Accepted"
          value={currentStats.emailsAccepted.toLocaleString()}
          icon={Mail}
          color="bg-gdg-red"
          subtext={`${currentStats.emailsDelivered} confirmed delivered`}
        />
      </div>

      {/* Email Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Pending", value: currentStats.emailPending, icon: Clock, cls: "text-gray-500 bg-gray-50 border-gray-200" },
          { label: "Delivered", value: currentStats.emailsDelivered, icon: MailCheck, cls: "text-green-600 bg-green-50 border-green-200" },
          { label: "Bounced", value: currentStats.emailsBounced, icon: MailX, cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
          { label: "Failed", value: currentStats.emailsFailed, icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
            <Icon size={18} />
            <div>
              <p className="text-xs font-medium opacity-70">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Check-in Progress */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp size={18} className="text-gdg-green" />
            Check-in Progress
          </h2>
          <div className="flex items-center justify-center">
            <div className="relative">
              <PieChart width={200} height={200}>
                <Pie
                  data={checkInData}
                  cx={100}
                  cy={100}
                  innerRadius={55}
                  outerRadius={85}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                >
                  {checkInData.map((_entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-gdg-navy">{currentStats.checkInPercentage}%</span>
                <span className="text-xs text-gray-500">attended</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {checkInData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {d.name}: <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email Distribution */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="section-title flex items-center gap-2">
            <Send size={18} className="text-gdg-blue" />
            Email Delivery Status
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={emailChartData} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {emailChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Check-ins */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <CheckCircle size={18} className="text-gdg-green" />
            Recent Check-ins
          </h2>
          {currentStats.recentCheckIns.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No check-ins yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {currentStats.recentCheckIns.map((log) => (
                <li key={log._id} className="flex items-center gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                  <div className="w-8 h-8 rounded-full bg-gdg-green flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gdg-navy truncate">
                      {log.staffName ?? "Staff"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(log.checkedInAt), "HH:mm:ss · MMM d")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Email Errors */}
        <div className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <AlertTriangle size={18} className="text-gdg-red" />
            Recent Email Errors
          </h2>
          {currentStats.recentEmailErrors.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MailCheck size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No email errors</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {currentStats.recentEmailErrors.map((job) => (
                <li key={job._id} className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                  <XCircle size={16} className="text-gdg-red flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gdg-navy truncate">{job.recipientEmail}</p>
                    <p className="text-xs text-red-600 truncate">{job.lastError ?? "Unknown error"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
