import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { EmailJob } from "@/models/EmailJob";
import { CheckInLog } from "@/models/CheckInLog";
import { Ticket } from "@/models/Ticket";
import DashboardClient from "./DashboardClient";

async function getDashboardStats() {
  await connectDB();

  const [
    totalAttendees,
    ticketsGenerated,
    emailsAccepted,
    emailsDelivered,
    emailsBounced,
    emailsFailed,
    checkedIn,
    notCheckedIn,
    recentCheckIns,
    recentEmailErrors,
    emailPending,
  ] = await Promise.all([
    Attendee.countDocuments({ isValid: true }),
    Ticket.countDocuments({ isRevoked: false }),
    EmailJob.countDocuments({ status: { $in: ["accepted", "delivered"] } }),
    EmailJob.countDocuments({ status: "delivered" }),
    EmailJob.countDocuments({ status: "bounced" }),
    EmailJob.countDocuments({ status: { $in: ["failed", "permanently_failed"] } }),
    Attendee.countDocuments({ checkInStatus: "checked_in" }),
    Attendee.countDocuments({ checkInStatus: "not_checked_in", isValid: true }),
    CheckInLog.find({ outcome: "success" })
      .sort({ checkedInAt: -1 })
      .limit(10)
      .lean(),
    EmailJob.find({ status: { $in: ["failed", "permanently_failed"] } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
    EmailJob.countDocuments({ status: "pending" }),
  ]);

  return {
    totalAttendees,
    ticketsGenerated,
    emailsAccepted,
    emailsDelivered,
    emailsBounced,
    emailsFailed,
    emailPending,
    checkedIn,
    notCheckedIn,
    checkInPercentage: totalAttendees > 0 ? Math.round((checkedIn / totalAttendees) * 100) : 0,
    recentCheckIns: JSON.parse(JSON.stringify(recentCheckIns)),
    recentEmailErrors: JSON.parse(JSON.stringify(recentEmailErrors)),
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  return <DashboardClient stats={stats} />;
}
