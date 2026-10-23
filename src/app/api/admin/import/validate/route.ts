import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseExcelBuffer, mapAndValidateRows, ColumnMapping } from "@/lib/excel";
import { z } from "zod";

const ValidateSchema = z.object({
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
    const result = ValidateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { fileData, mapping } = result.data;
    const buffer = Buffer.from(fileData, "base64");
    const { rows } = parseExcelBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

    const { valid, errors } = mapAndValidateRows(rows, mapping as ColumnMapping);

    // Detect duplicates within the file
    const seenEmails = new Set<string>();
    const seenRegIds = new Set<string>();
    const dedupErrors: typeof errors = [];

    const dedupedValid = valid.filter((row) => {
      const email = row.email!.toLowerCase();
      if (seenEmails.has(email)) {
        dedupErrors.push({ rowIndex: row.rowIndex, field: "email", message: `Duplicate email within file: ${email}` });
        return false;
      }
      seenEmails.add(email);

      if (row.registrationId) {
        if (seenRegIds.has(row.registrationId)) {
          dedupErrors.push({ rowIndex: row.rowIndex, field: "registrationId", message: `Duplicate registration ID: ${row.registrationId}` });
          return false;
        }
        seenRegIds.add(row.registrationId);
      }

      return true;
    });

    return NextResponse.json({
      valid: dedupedValid,
      errors: [...errors, ...dedupErrors],
      summary: {
        total: rows.length,
        valid: dedupedValid.length,
        invalid: errors.length + dedupErrors.length,
      },
    });
  } catch (err) {
    console.error("Validate error:", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
