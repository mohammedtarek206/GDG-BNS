import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { EmailJob } from "@/models/EmailJob";
import { Ticket } from "@/models/Ticket";
import { CheckInLog } from "@/models/CheckInLog";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const [
    totalAttendees,
    ticketsGenerated,
    emailsAccepted,
    emailsDelivered,
    emailsBounced,
    emailsFailed,
    emailPending,
    checkedIn,
    notCheckedIn,
    recentCheckIns,
    recentEmailErrors,
  ] = await Promise.all([
    Attendee.countDocuments({ isValid: true }),
    Ticket.countDocuments({ isRevoked: false }),
    EmailJob.countDocuments({ status: { $in: ["accepted", "delivered"] } }),
    EmailJob.countDocuments({ status: "delivered" }),
    EmailJob.countDocuments({ status: "bounced" }),
    EmailJob.countDocuments({ status: { $in: ["failed", "permanently_failed"] } }),
    EmailJob.countDocuments({ status: "pending" }),
    Attendee.countDocuments({ checkInStatus: "checked_in", isValid: true }),
    Attendee.countDocuments({ checkInStatus: "not_checked_in", isValid: true }),
    CheckInLog.find({ outcome: "success" })
      .sort({ checkedInAt: -1 })
      .limit(5)
      .lean(),
    EmailJob.find({ status: { $in: ["failed", "permanently_failed", "bounced"] } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return NextResponse.json({
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
  });
}
