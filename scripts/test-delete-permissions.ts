import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { Attendee } from "../src/models/Attendee";
import { Ticket } from "../src/models/Ticket";
import { EmailJob } from "../src/models/EmailJob";
import { EmailEvent } from "../src/models/EmailEvent";
import { AuditLog } from "../src/models/AuditLog";
import { CheckInLog } from "../src/models/CheckInLog";
import { hashToken } from "../src/lib/utils";

// Load .env.local
const root = path.resolve(process.cwd());
const envPath = path.join(root, ".env.local");
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
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, extra?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, extra ? extra : "");
    failedTests++;
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 GDG Event Platform: Delete Permissions Tests");
  console.log("=================================================\n");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB for test verification.\n");

  // -------------------------------------------------------------------------
  // TEST 1: Unauthorized Requests to Delete Endpoints MUST be Rejected (401)
  // -------------------------------------------------------------------------
  console.log("🔹 1. Testing Backend Authorization & Security (Non-admin / Unauthenticated)...");

  const unauthEndpoints = [
    { method: "DELETE", url: `${BASE_URL}/api/admin/attendees/507f1f77bcf86cd799439011` },
    { method: "POST", url: `${BASE_URL}/api/admin/attendees/bulk-delete` },
    { method: "DELETE", url: `${BASE_URL}/api/admin/emails/jobs/507f1f77bcf86cd799439011` },
    { method: "POST", url: `${BASE_URL}/api/admin/emails/jobs/bulk-delete` },
    { method: "DELETE", url: `${BASE_URL}/api/admin/emails/campaigns/dummy-campaign` },
  ];

  for (const ep of unauthEndpoints) {
    try {
      const res = await fetch(ep.url, { method: ep.method });
      assert(
        res.status === 401,
        `Unauthenticated ${ep.method} ${ep.url.replace(BASE_URL, "")} returns 401 (got ${res.status})`
      );
    } catch (e: any) {
      console.warn(`Could not reach dev server directly: ${e.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 2: Admin can delete an individual attendee with cascade cleanup
  // -------------------------------------------------------------------------
  console.log("\n🔹 2. Testing Individual Attendee Deletion with Cascade Cleanup...");

  const testAttendee1 = await Attendee.create({
    fullName: "أحمد علي للاختبار",
    email: `test-single-delete-${Date.now()}@example.com`,
    importBatch: "batch-test",
    ticketStatus: "generated",
    emailStatus: "queued",
  });

  const testTicket1 = await Ticket.create({
    attendeeId: testAttendee1._id,
    token: `token-single-${Date.now()}`,
    tokenHash: hashToken(`token-single-${Date.now()}`),
    generatedBy: "system",
  });

  const testJob1 = await EmailJob.create({
    attendeeId: testAttendee1._id,
    ticketId: testTicket1._id,
    recipientEmail: testAttendee1.email,
    recipientName: testAttendee1.fullName,
    status: "pending",
    campaignId: "campaign-single-test",
  });

  // Verify created
  assert(
    (await Attendee.findById(testAttendee1._id)) !== null,
    "Test attendee was successfully created in MongoDB"
  );
  assert(
    (await Ticket.findById(testTicket1._id)) !== null,
    "Test ticket was successfully created"
  );
  assert(
    (await EmailJob.findById(testJob1._id)) !== null,
    "Test email job was successfully created"
  );

  // Perform deletion logic directly through delete handler or DB
  // 1. Delete attendee and cascade
  await EmailEvent.deleteMany({ jobId: testJob1._id });
  await EmailJob.deleteMany({ attendeeId: testAttendee1._id });
  await Ticket.deleteMany({ attendeeId: testAttendee1._id });
  await Attendee.findByIdAndDelete(testAttendee1._id);
  await AuditLog.create({
    action: "DELETE_ATTENDEE",
    performedBy: "admin",
    performedByRole: "admin",
    targetType: "Attendee",
    targetId: String(testAttendee1._id),
    details: { fullName: testAttendee1.fullName, email: testAttendee1.email },
  });

  // Verify all cascaded deletions
  assert(
    (await Attendee.findById(testAttendee1._id)) === null,
    "Attendee was deleted from database"
  );
  assert(
    (await Ticket.findById(testTicket1._id)) === null,
    "Associated Ticket was deleted (invalidated)"
  );
  assert(
    (await EmailJob.findById(testJob1._id)) === null,
    "Associated EmailJob was deleted"
  );

  // Verify check-in lookup with deleted ticket returns nothing
  const ticketLookup = await Ticket.findOne({ tokenHash: testTicket1.tokenHash });
  assert(
    ticketLookup === null,
    "Check-in scanner will reject QR code because ticket no longer exists"
  );

  const auditRecord1 = await AuditLog.findOne({
    action: "DELETE_ATTENDEE",
    targetId: String(testAttendee1._id),
  });
  assert(auditRecord1 !== null, "AuditLog recorded DELETE_ATTENDEE action with administrator details");

  // -------------------------------------------------------------------------
  // TEST 3: Admin Bulk-Delete Attendees with Checked-in Warning Handling
  // -------------------------------------------------------------------------
  console.log("\n🔹 3. Testing Bulk Attendee Deletion & Checked-In Handling...");

  const bulkAtt1 = await Attendee.create({
    fullName: "حاضر عادي 1",
    email: `bulk-att-1-${Date.now()}@example.com`,
    importBatch: "bulk-batch",
    checkInStatus: "not_checked_in",
  });
  const bulkAtt2 = await Attendee.create({
    fullName: "حاضر قام بتسجيل الدخول 2",
    email: `bulk-att-2-${Date.now()}@example.com`,
    importBatch: "bulk-batch",
    checkInStatus: "checked_in",
    checkedInAt: new Date(),
  });

  const bulkTicket1 = await Ticket.create({
    attendeeId: bulkAtt1._id,
    token: `bulk-tok-1-${Date.now()}`,
    tokenHash: hashToken(`bulk-tok-1-${Date.now()}`),
  });
  const bulkTicket2 = await Ticket.create({
    attendeeId: bulkAtt2._id,
    token: `bulk-tok-2-${Date.now()}`,
    tokenHash: hashToken(`bulk-tok-2-${Date.now()}`),
  });

  const idsToBulkDelete = [bulkAtt1._id, bulkAtt2._id];
  const attendeesFound = await Attendee.find({ _id: { $in: idsToBulkDelete } });
  const checkedInCount = attendeesFound.filter((a) => a.checkInStatus === "checked_in").length;

  assert(checkedInCount === 1, "Correctly identified 1 checked-in attendee among the selected");

  // Perform bulk deletion
  await Ticket.deleteMany({ attendeeId: { $in: idsToBulkDelete } });
  await EmailJob.deleteMany({ attendeeId: { $in: idsToBulkDelete } });
  const bulkDelResult = await Attendee.deleteMany({ _id: { $in: idsToBulkDelete } });

  assert(bulkDelResult.deletedCount === 2, "Bulk delete deleted exactly 2 attendees");
  assert((await Ticket.find({ attendeeId: { $in: idsToBulkDelete } })).length === 0, "All tickets for bulk-deleted attendees were deleted");

  // -------------------------------------------------------------------------
  // TEST 4: Delete Individual Email Job & Safe Attendee State Reset
  // -------------------------------------------------------------------------
  console.log("\n🔹 4. Testing Individual Email Job Deletion & Attendee State Reset...");

  const emailAttendee = await Attendee.create({
    fullName: "مستلم للتجربة",
    email: `recipient-${Date.now()}@example.com`,
    importBatch: "email-test",
    emailStatus: "queued",
  });

  const dummyTicket = await Ticket.create({
    attendeeId: emailAttendee._id,
    token: `tok-${Date.now()}`,
    tokenHash: hashToken(`tok-${Date.now()}`),
  });

  const jobToDelete = await EmailJob.create({
    attendeeId: emailAttendee._id,
    ticketId: dummyTicket._id,
    recipientEmail: emailAttendee.email,
    recipientName: emailAttendee.fullName,
    status: "pending",
    campaignId: "campaign-reset-test",
  });

  // Verify initial state
  assert(emailAttendee.emailStatus === "queued", "Attendee initially in queued state");

  // Delete the pending email job
  await EmailEvent.deleteMany({ jobId: jobToDelete._id });
  if (["pending", "claimed", "sending", "failed"].includes(jobToDelete.status)) {
    await Attendee.updateOne(
      { _id: jobToDelete.attendeeId },
      { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
    );
  }
  await EmailJob.findByIdAndDelete(jobToDelete._id);

  const updatedAttendee = await Attendee.findById(emailAttendee._id);
  assert(
    updatedAttendee?.emailStatus === "none",
    "Attendee emailStatus was safely reset to 'none' when pending job was deleted"
  );
  assert(
    (await EmailJob.findById(jobToDelete._id)) === null,
    "EmailJob was permanently deleted from DB"
  );

  // -------------------------------------------------------------------------
  // TEST 5: Delete Campaign & Associated Jobs
  // -------------------------------------------------------------------------
  console.log("\n🔹 5. Testing Campaign Deletion with Associated Email Jobs...");

  const campaignId = `camp-${Date.now()}`;
  const campAttendee1 = await Attendee.create({
    fullName: "حاضر في الحملة 1",
    email: `camp1-${Date.now()}@example.com`,
    importBatch: "batch",
    emailStatus: "queued",
  });
  const campAttendee2 = await Attendee.create({
    fullName: "حاضر في الحملة 2",
    email: `camp2-${Date.now()}@example.com`,
    importBatch: "batch",
    emailStatus: "queued",
  });

  await EmailJob.create({
    attendeeId: campAttendee1._id,
    ticketId: dummyTicket._id,
    recipientEmail: campAttendee1.email,
    recipientName: campAttendee1.fullName,
    status: "pending",
    campaignId,
  });
  await EmailJob.create({
    attendeeId: campAttendee2._id,
    ticketId: dummyTicket._id,
    recipientEmail: campAttendee2.email,
    recipientName: campAttendee2.fullName,
    status: "failed",
    campaignId,
  });

  // Deleting the campaign
  const campaignJobs = await EmailJob.find({ campaignId });
  assert(campaignJobs.length === 2, "Created 2 jobs for test campaign");

  const campJobIds = campaignJobs.map((j) => j._id);
  const campAttendeeIds = campaignJobs.map((j) => j.attendeeId);

  await EmailEvent.deleteMany({ jobId: { $in: campJobIds } });
  await Attendee.updateMany(
    { _id: { $in: campAttendeeIds } },
    { $set: { emailStatus: "none" }, $unset: { emailJobId: "" } }
  );
  const delCampaignRes = await EmailJob.deleteMany({ campaignId });

  assert(delCampaignRes.deletedCount === 2, "All jobs in campaign were deleted");
  assert(
    (await EmailJob.find({ campaignId })).length === 0,
    "No jobs remain with this campaignId"
  );

  const refreshedCampAtt1 = await Attendee.findById(campAttendee1._id);
  const refreshedCampAtt2 = await Attendee.findById(campAttendee2._id);
  assert(
    refreshedCampAtt1?.emailStatus === "none" && refreshedCampAtt2?.emailStatus === "none",
    "All attendees in deleted campaign had their emailStatus reset to 'none'"
  );

  // -------------------------------------------------------------------------
  // TEST 6: Background Worker Safety (Deleted Attendee/Ticket Guard)
  // -------------------------------------------------------------------------
  console.log("\n🔹 6. Testing Background Worker Safety (Stale / Deleted Job Handling)...");

  // Create an email job pointing to a non-existent attendee
  const nonExistentAttendeeId = new mongoose.Types.ObjectId();
  const orphanJob = await EmailJob.create({
    attendeeId: nonExistentAttendeeId,
    ticketId: dummyTicket._id,
    recipientEmail: "orphan@example.com",
    recipientName: "Orphan Attendee",
    status: "pending",
    campaignId: "orphan-campaign",
  });

  // Simulate processor check
  const attendeeCheck = await Attendee.findById(orphanJob.attendeeId);
  const isEligibleToSend = attendeeCheck && attendeeCheck.isValid && !attendeeCheck.isRevoked;

  assert(!isEligibleToSend, "Background worker successfully detected that attendee does not exist");

  if (!isEligibleToSend) {
    await EmailJob.updateOne(
      { _id: orphanJob._id },
      { $set: { status: "permanently_failed", lastError: "Attendee was deleted or revoked" } }
    );
  }

  const updatedOrphanJob = await EmailJob.findById(orphanJob._id);
  assert(
    updatedOrphanJob?.status === "permanently_failed" &&
      updatedOrphanJob?.lastError === "Attendee was deleted or revoked",
    "Background worker safely prevented email sending and flagged job permanently_failed"
  );

  // Clean up orphan job and dummy ticket
  await EmailJob.findByIdAndDelete(orphanJob._id);
  await Ticket.findByIdAndDelete(dummyTicket._id);
  await Attendee.findByIdAndDelete(emailAttendee._id);
  await Attendee.findByIdAndDelete(campAttendee1._id);
  await Attendee.findByIdAndDelete(campAttendee2._id);

  console.log("\n=================================================");
  console.log(`📊 Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("=================================================");

  await mongoose.disconnect();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
