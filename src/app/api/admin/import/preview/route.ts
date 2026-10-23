import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { parseExcelBuffer, autoDetectColumns } from "@/lib/excel";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json({ error: "Invalid file type. Upload .xlsx, .xls, or .csv" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 10MB" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { headers, rows } = parseExcelBuffer(buffer);

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: "File appears to be empty or has no headers" }, { status: 400 });
    }

    const detectedMapping = autoDetectColumns(headers);

    const preview = {
      headers,
      sampleRows: rows.slice(0, 5),
      detectedMapping,
      totalRows: rows.length,
      fileId: `preview_${Date.now()}`,
    };

    // Store file data as base64 for subsequent requests
    const uint8 = new Uint8Array(buffer);
    const fileData = Buffer.from(uint8).toString("base64");

    return NextResponse.json({ preview, fileData });
  } catch (err) {
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
