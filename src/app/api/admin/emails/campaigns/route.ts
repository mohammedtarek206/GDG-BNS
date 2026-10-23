import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmailJob } from "@/models/EmailJob";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 401 });
  }

  try {
    await connectDB();

    const campaigns = await EmailJob.aggregate([
      {
        $group: {
          _id: "$campaignId",
          total: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [{ $in: ["$status", ["pending", "claimed"]] }, 1, 0],
            },
          },
          sent: {
            $sum: {
              $cond: [{ $in: ["$status", ["accepted", "delivered"]] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $in: ["$status", ["failed", "permanently_failed", "bounced"]] }, 1, 0],
            },
          },
          firstCreated: { $min: "$createdAt" },
          lastUpdated: { $max: "$updatedAt" },
        },
      },
      { $sort: { lastUpdated: -1 } },
    ]);

    const formatted = campaigns.map((c) => ({
      campaignId: c._id || "default",
      total: c.total,
      pending: c.pending,
      sent: c.sent,
      failed: c.failed,
      firstCreated: c.firstCreated,
      lastUpdated: c.lastUpdated,
    }));

    return NextResponse.json({ campaigns: formatted });
  } catch (err: any) {
    console.error("Fetch campaigns error:", err);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
