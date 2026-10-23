import crypto from "crypto";

/**
 * Generate a cryptographically random token (URL-safe base64)
 * that will be embedded in the QR code.
 */
export function generateTicketToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Hash a ticket token with SHA-256 for safe database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a campaign ID for bulk email runs.
 */
export function generateCampaignId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex");
  return `campaign_${ts}_${rand}`;
}

/**
 * Generate an import batch ID.
 */
export function generateImportBatchId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex");
  return `import_${ts}_${rand}`;
}

/**
 * Validate email with a reasonable regex.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

/**
 * Sanitize a string to prevent injection / XSS in exports.
 * Strips leading = + - @ chars that could trigger formula injection in CSV/Excel.
 */
export function sanitizeForExport(value: string): string {
  return value.replace(/^[=+\-@\t\r]/g, "'$&");
}

/**
 * Exponential backoff delay in ms given attempt number (0-indexed).
 * Capped at 1 hour.
 */
export function backoffDelay(attempt: number): number {
  const base = 60 * 1000; // 1 minute
  const delay = Math.min(base * Math.pow(2, attempt), 60 * 60 * 1000);
  return delay;
}

/**
 * Obfuscate email for safe display (e.g. logs):
 * "user@example.com" → "us**@ex**.com"
 */
export function obfuscateEmail(email: string): string {
  const [local, domain] = email.split("@");
  const safeLocal = local.slice(0, 2) + "**";
  const [domainName, ...tld] = domain.split(".");
  const safeDomain = domainName.slice(0, 2) + "**";
  return `${safeLocal}@${safeDomain}.${tld.join(".")}`;
}
