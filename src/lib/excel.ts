import * as XLSX from "xlsx";
import { isValidEmail } from "./utils";

export interface ParsedRow {
  rowIndex: number;
  fullName?: string;
  email?: string;
  phone?: string;
  registrationId?: string;
  organization?: string;
  [key: string]: unknown;
}

export interface ImportError {
  rowIndex: number;
  field: string;
  message: string;
  rawData?: Record<string, unknown>;
}

export interface ColumnMapping {
  fullName: string;
  email: string;
  phone?: string;
  registrationId?: string;
  organization?: string;
}

// Common column name aliases (Arabic and English)
const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  fullName: [
    "full name", "fullname", "name", "الاسم", "الاسم الكامل", "اسم", "attendee name",
    "participant name", "student name", "الاسم الكامل للمشارك",
  ],
  email: [
    "email", "email address", "e-mail", "البريد الإلكتروني", "بريد إلكتروني",
    "e mail", "emailaddress",
  ],
  phone: [
    "phone", "phone number", "mobile", "mobile number", "رقم الهاتف", "هاتف",
    "رقم الجوال", "جوال", "tel", "telephone",
  ],
  registrationId: [
    "registration id", "reg id", "id", "ticket id", "registration number",
    "رقم التسجيل", "رقم التذكرة", "registration_id", "regid",
  ],
  organization: [
    "organization", "organisation", "company", "university", "school",
    "الجامعة", "المنظمة", "الشركة", "المؤسسة", "faculty", "college",
  ],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_\-]+/g, " ");
}

export function autoDetectColumns(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof ColumnMapping, string[]][]) {
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex((h) => h === alias || h.includes(alias));
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  return mapping;
}

export function fixMojibake(text: string): string {
  if (!text || typeof text !== "string") return text;
  // Pattern matching UTF-8 multibyte sequences misread as latin1 (e.g. Ù…Ø±ÙŠÙ…)
  if (/[\u00C0-\u00DF][\u0080-\u00BF]/.test(text) || /[\u00E0-\u00EF][\u0080-\u00BF]{2}/.test(text)) {
    try {
      const decoded = Buffer.from(text, "latin1").toString("utf8");
      if (!decoded.includes("\uFFFD")) {
        return decoded;
      }
    } catch {
      // Fallback to original text if decoding fails
    }
  }
  return text;
}

export function parseExcelBuffer(
  buffer: ArrayBuffer
): { headers: string[]; rows: Record<string, unknown>[] } {
  // Pass codepage 65001 (UTF-8) so CSV files default to UTF-8 instead of Windows-1252
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  return { headers, rows: rawRows };
}

export function mapAndValidateRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  startIndex: number = 2 // Excel row 2 (after header)
): { valid: ParsedRow[]; errors: ImportError[] } {
  const valid: ParsedRow[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, i) => {
    const rowIndex = startIndex + i;
    const rowErrors: ImportError[] = [];

    const fullName = fixMojibake(String(row[mapping.fullName] ?? "").trim());
    const email = String(row[mapping.email] ?? "").trim().toLowerCase();
    const phone = mapping.phone ? fixMojibake(String(row[mapping.phone] ?? "").trim()) : undefined;
    const registrationId = mapping.registrationId
      ? fixMojibake(String(row[mapping.registrationId] ?? "").trim())
      : undefined;
    const organization = mapping.organization
      ? fixMojibake(String(row[mapping.organization] ?? "").trim())
      : undefined;

    if (!fullName) {
      rowErrors.push({ rowIndex, field: "fullName", message: "Full name is required", rawData: row as Record<string, unknown> });
    }
    if (!email) {
      rowErrors.push({ rowIndex, field: "email", message: "Email address is required", rawData: row as Record<string, unknown> });
    } else if (!isValidEmail(email)) {
      rowErrors.push({ rowIndex, field: "email", message: `Invalid email: "${email}"`, rawData: row as Record<string, unknown> });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push({
        rowIndex,
        fullName,
        email,
        phone: phone || undefined,
        registrationId: registrationId || undefined,
        organization: organization || undefined,
        ...row,
      });
    }
  });

  return { valid, errors };
}

