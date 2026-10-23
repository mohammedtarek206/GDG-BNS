import { sendTicketEmail } from "../src/lib/email";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(process.cwd());
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length > 0) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

async function main() {
  console.log("Using API KEY:", process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 10)}...` : "NONE");
  console.log("Testing Resend delivery to delivered@resend.dev with Arabic recipient name...");
  const res = await sendTicketEmail({
    to: "delivered@resend.dev",
    recipientName: "مريم محمد حسين ميهوب",
    eventName: "GDG DevFest 2024",
    ticketReference: "TEST-TICKET-2024",
    qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    ticketUrl: "http://localhost:3000/ticket/TEST-TICKET-2024",
  });
  console.log("Result:", res);
}

main();
