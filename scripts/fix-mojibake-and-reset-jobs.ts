import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length > 0 && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gdg-event";

function fixMojibake(text: string): string {
  if (!text || typeof text !== "string") return text;
  if (/[\u00C0-\u00DF][\u0080-\u00BF]/.test(text) || /[\u00E0-\u00EF][\u0080-\u00BF]{2}/.test(text)) {
    try {
      const decoded = Buffer.from(text, "latin1").toString("utf8");
      if (!decoded.includes("\uFFFD")) {
        return decoded;
      }
    } catch {
      // ignore
    }
  }
  return text;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB:", MONGODB_URI);

  const Attendee = mongoose.model(
    "Attendee",
    new mongoose.Schema({}, { strict: false, collection: "attendees" })
  );

  const EmailJob = mongoose.model(
    "EmailJob",
    new mongoose.Schema({}, { strict: false, collection: "emailjobs" })
  );

  const attendees = await Attendee.find({});
  console.log(`Found ${attendees.length} attendees.`);

  let attendeeFixedCount = 0;
  for (const att of attendees) {
    let updated = false;
    const updates: Record<string, any> = {};

    const rawFullName = att.get("fullName");
    if (rawFullName) {
      const fixed = fixMojibake(rawFullName);
      if (fixed !== rawFullName) {
        updates.fullName = fixed;
        updated = true;
      }
    }

    const rawOrg = att.get("organization");
    if (rawOrg) {
      const fixed = fixMojibake(rawOrg);
      if (fixed !== rawOrg) {
        updates.organization = fixed;
        updated = true;
      }
    }

    if (updated) {
      await Attendee.updateOne({ _id: att._id }, { $set: updates });
      attendeeFixedCount++;
      console.log(`Fixed attendee [${att.get("email")}]: "${rawFullName}" -> "${updates.fullName || rawFullName}"`);
    }
  }

  console.log(`Fixed ${attendeeFixedCount} attendees' names.`);

  const jobs = await EmailJob.find({});
  console.log(`Found ${jobs.length} email jobs.`);

  let jobFixedCount = 0;
  let jobResetCount = 0;

  for (const job of jobs) {
    let updated = false;
    const updates: Record<string, any> = {};

    const rawRecipientName = job.get("recipientName");
    if (rawRecipientName) {
      const fixed = fixMojibake(rawRecipientName);
      if (fixed !== rawRecipientName) {
        updates.recipientName = fixed;
        updated = true;
      }
    }

    // Reset failed/permanently_failed jobs to pending so they can be tried again
    const status = job.get("status");
    if (status === "failed" || status === "permanently_failed") {
      updates.status = "pending";
      updates.attempts = 0;
      updates.lastError = undefined;
      updates.nextRetryAt = undefined;
      updated = true;
      jobResetCount++;
    }

    if (updated) {
      await EmailJob.updateOne({ _id: job._id }, { $set: updates });
      jobFixedCount++;
    }
  }

  // Also reset attendee emailStatus to "queued" if their job is pending
  const resetAttendees = await Attendee.updateMany(
    { emailStatus: { $in: ["failed", "none"] } },
    { $set: { emailStatus: "queued" } }
  );
  console.log(`Updated ${resetAttendees.modifiedCount} attendees emailStatus to 'queued'.`);

  console.log(`Fixed ${jobFixedCount} email jobs (${jobResetCount} were reset to 'pending').`);
  await mongoose.disconnect();
  console.log("Done!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
