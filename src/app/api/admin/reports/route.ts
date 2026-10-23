import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { CheckInLog } from "@/models/CheckInLog";
import { EmailJob } from "@/models/EmailJob";
import { Ticket } from "@/models/Ticket";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const [
    totalAttendees,
    checkedIn,
    totalTickets,
    emailStats,
    checkInLogs,
    orgAgg,
  ] = await Promise.all([
    Attendee.countDocuments({ isValid: true }),
    Attendee.countDocuments({ isValid: true, checkInStatus: "checked_in" }),
    Ticket.countDocuments({ isRevoked: false }),
    EmailJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    CheckInLog.find({ outcome: "success" })
      .select("checkedInAt")
      .lean(),
    Attendee.aggregate([
      { $match: { isValid: true, organization: { $exists: true, $ne: "" } } },
      { $group: { _id: "$organization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  // Aggregate check-ins by hour
  const hourlyMap: Record<string, number> = {};
  checkInLogs.forEach((log) => {
    if (log.checkedInAt) {
      const d = new Date(log.checkedInAt);
      const hourStr = `${String(d.getHours()).padStart(2, "0")}:00`;
      hourlyMap[hourStr] = (hourlyMap[hourStr] || 0) + 1;
    }
  });

  const hourlyCheckIns = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, count }));

  // Format email funnel
  const emailCounts: Record<string, number> = {};
  emailStats.forEach((s) => {
    emailCounts[s._id] = s.count;
  });

  const topOrganizations = orgAgg.map((o) => ({
    name: o._id || "Unknown",
    attendees: o.count,
  }));

  return NextResponse.json({
    totalAttendees,
    checkedIn,
    attendanceRate: totalAttendees > 0 ? Math.round((checkedIn / totalAttendees) * 100) : 0,
    totalTickets,
    hourlyCheckIns,
    topOrganizations,
    emailFunnel: {
      pending: emailCounts["pending"] ?? 0,
      accepted: emailCounts["accepted"] ?? 0,
      delivered: emailCounts["delivered"] ?? 0,
      bounced: emailCounts["bounced"] ?? 0,
      failed: (emailCounts["failed"] ?? 0) + (emailCounts["permanently_failed"] ?? 0),
    },
  });
}
