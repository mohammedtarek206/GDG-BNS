import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseExcelBuffer, mapAndValidateRows, ColumnMapping } from "@/lib/excel";
import { connectDB } from "@/lib/db";
import { Attendee } from "@/models/Attendee";
import { AuditLog } from "@/models/AuditLog";
import { generateImportBatchId } from "@/lib/utils";
import { z } from "zod";

const CommitSchema = z.object({
  fileData: z.string().min(1),
  mapping: z.object({
    fullName: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().optional(),
    registrationId: z.string().optional(),
    organization: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = CommitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { fileData, mapping } = result.data;
    const buffer = Buffer.from(fileData, "base64");
    const { rows } = parseExcelBuffer(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
    );
    const { valid, errors } = mapAndValidateRows(rows, mapping as ColumnMapping);

    await connectDB();
    const batchId = generateImportBatchId();

    let imported = 0;
    let skipped = 0;
    const failedRows: typeof errors = [];

    // Process in batches of 50 to avoid memory issues
    for (let i = 0; i < valid.length; i += 50) {
      const batch = valid.slice(i, i + 50);

      for (const row of batch) {
        try {
          const existing = await Attendee.findOne({
            $or: [
              { email: row.email },
              ...(row.registrationId ? [{ registrationId: row.registrationId }] : []),
            ],
          });

          if (existing) {
            // Safe re-import: don't overwrite check-in or ticket status
            skipped++;
            continue;
          }

          await Attendee.create({
            fullName: row.fullName,
            email: row.email,
            phone: row.phone,
            registrationId: row.registrationId,
            organization: row.organization,
            importBatch: batchId,
            importedAt: new Date(),
            rawImportData: row,
            isValid: true,
          });

          imported++;
        } catch (err) {
          failedRows.push({
            rowIndex: row.rowIndex,
            field: "unknown",
            message: err instanceof Error ? err.message : "DB insert failed",
          });
        }
      }
    }

    // Audit log
    await AuditLog.create({
      action: "IMPORT_ATTENDEES",
      performedBy: session.userId ?? "unknown",
      performedByRole: "admin",
      details: { batchId, imported, skipped, failed: failedRows.length },
    });

    return NextResponse.json({
      imported,
      skipped,
      errors: [...errors, ...failedRows],
      batchId,
    });
  } catch (err) {
    console.error("Commit error:", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
