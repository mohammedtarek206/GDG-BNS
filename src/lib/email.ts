import { Resend } from "resend";

export interface SendTicketEmailParams {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate?: string;
  eventVenue?: string;
  ticketReference: string;
  qrDataUrl: string;
  logoUrl?: string;
  supportEmail?: string;
  ticketUrl: string;
}

export async function sendTicketEmail(params: SendTicketEmailParams): Promise<{
  messageId?: string;
  error?: string;
}> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith("re_mock")) {
      return { error: "Resend API key is not configured in .env.local" };
    }

    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM || "GDG Event <noreply@gdgbns.online>";

    const html = buildTicketEmailHtml(params);
    const text = buildTicketEmailText(params);

    const { data, error } = await resend.emails.send({
      from,
      to: [params.to],
      subject: `🎟️ Your Ticket for ${params.eventName}`,
      html,
      text,
    });

    if (error) {
      return { error: error.message };
    }

    return { messageId: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function buildTicketEmailHtml(params: SendTicketEmailParams): string {
  const {
    recipientName,
    eventName,
    eventDate,
    eventVenue,
    ticketReference,
    qrDataUrl,
    logoUrl,
    supportEmail,
    ticketUrl,
  } = params;

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket – ${eventName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4285F4 0%,#1a73e8 100%);padding:32px;text-align:center;">
            ${logoUrl ? `<img src="${logoUrl}" alt="GDG Logo" style="height:60px;margin-bottom:16px;">` : ""}
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Your Event Ticket</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:16px;">${eventName}</p>
          </td>
        </tr>
        <!-- Greeting -->
        <tr>
          <td style="padding:32px 40px 16px;">
            <p style="font-size:18px;color:#1a1f36;margin:0 0 8px;">Hello, <strong>${recipientName}</strong>! 👋</p>
            <p style="font-size:15px;color:#475569;line-height:1.6;margin:0;">
              We're excited to have you join us! Below is your unique QR code ticket.
              Please present it at the entrance on the day of the event.
            </p>
          </td>
        </tr>
        <!-- QR Code -->
        <tr>
          <td align="center" style="padding:24px 40px;">
            <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:16px;padding:24px;display:inline-block;">
              <img src="${qrDataUrl}" alt="QR Code" style="width:200px;height:200px;display:block;">
            </div>
          </td>
        </tr>
        <!-- Event Details -->
        <tr>
          <td style="padding:0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="8" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:13px;width:140px;">🎪 Event</td>
                      <td style="color:#1a1f36;font-size:14px;font-weight:600;">${eventName}</td>
                    </tr>
                    ${eventDate ? `<tr>
                      <td style="color:#64748b;font-size:13px;">📅 Date</td>
                      <td style="color:#1a1f36;font-size:14px;">${eventDate}</td>
                    </tr>` : ""}
                    ${eventVenue ? `<tr>
                      <td style="color:#64748b;font-size:13px;">📍 Venue</td>
                      <td style="color:#1a1f36;font-size:14px;">${eventVenue}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="color:#64748b;font-size:13px;">🎫 Reference</td>
                      <td style="color:#1a1f36;font-size:14px;font-family:monospace;">${ticketReference}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- View Online Button -->
        <tr>
          <td align="center" style="padding:0 40px 32px;">
            <a href="${ticketUrl}" style="display:inline-block;background:#4285F4;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
              View Ticket Online →
            </a>
          </td>
        </tr>
        <!-- Instructions -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fffbeb;border-left:4px solid #FBBC05;border-radius:4px;padding:16px;">
              <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">
                <strong>📋 Entry Instructions:</strong><br>
                Please arrive a few minutes early and have your QR code ready to scan.<br>
                If you face any issues, contact our support team at
                <a href="mailto:${supportEmail ?? "support@example.com"}" style="color:#4285F4;">${supportEmail ?? "support@example.com"}</a>.
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              This ticket was sent to you because you registered for ${eventName}.<br>
              © 2024 GDG Event Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildTicketEmailText(params: SendTicketEmailParams): string {
  return `Hello ${params.recipientName},

Your ticket for ${params.eventName} is ready!

Event: ${params.eventName}
${params.eventDate ? `Date: ${params.eventDate}` : ""}
${params.eventVenue ? `Venue: ${params.eventVenue}` : ""}
Ticket Reference: ${params.ticketReference}

View your ticket online: ${params.ticketUrl}

Please present your QR code at the entrance on the day of the event.

If you have any questions, contact us at: ${params.supportEmail ?? "support@example.com"}

See you there!
`;
}

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_mock")) return null;
  return new Resend(apiKey);
}
