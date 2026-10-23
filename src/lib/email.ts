import { Resend } from "resend";

export interface SendTicketEmailParams {
  to: string;
  recipientName: string;
  eventName: string;
  eventDate?: string;
  eventVenue?: string;
  ticketReference: string;
  qrDataUrl: string;
  qrImageUrl?: string;
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

    // Prepare attachments: attach QR Code as a PNG attachment
    const attachments: Array<{ filename: string; content: Buffer }> = [];
    if (params.qrDataUrl && params.qrDataUrl.includes("base64,")) {
      try {
        const base64Content = params.qrDataUrl.split("base64,")[1];
        if (base64Content) {
          attachments.push({
            filename: `Ticket-${params.ticketReference}-QR.png`,
            content: Buffer.from(base64Content, "base64"),
          });
        }
      } catch (e) {
        console.warn("Failed to attach QR buffer:", e);
      }
    }

    const html = buildTicketEmailHtml(params);
    const text = buildTicketEmailText(params);

    const { data, error } = await resend.emails.send({
      from,
      to: [params.to],
      subject: `🎟️ Your Ticket for ${params.eventName}`,
      html,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
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

  // Use public endpoint image if available, otherwise fallback
  const qrImageUrl = params.qrImageUrl || `${ticketUrl}/qr`;
  const hasValidLogo = logoUrl && (logoUrl.startsWith("http://") || logoUrl.startsWith("https://"));

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket – ${eventName}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.3);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#1d4ed8 100%);padding:36px 32px;text-align:center;">
            <!-- Brand Dots -->
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:14px;">
              <tr>
                <td style="padding:0 3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4285F4;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#EA4335;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#FBBC05;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#34A853;"></span></td>
              </tr>
            </table>
            ${hasValidLogo ? `<img src="${logoUrl}" alt="Event Logo" style="height:48px;margin-bottom:12px;max-width:220px;">` : ""}
            <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Official Event Ticket</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;font-weight:500;">${eventName}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 36px 16px;">
            <p style="font-size:18px;color:#0f172a;margin:0 0 8px;font-weight:600;">Hello, <span style="color:#2563eb;">${recipientName}</span>! 👋</p>
            <p style="font-size:15px;color:#475569;line-height:1.6;margin:0;">
              Your registration is confirmed! Below is your unique entry pass.
              Please present this QR code at the registration desk on the event day.
            </p>
          </td>
        </tr>

        <!-- QR Code Card -->
        <tr>
          <td align="center" style="padding:16px 36px 24px;">
            <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:20px;padding:24px;display:inline-block;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
              <img src="${qrImageUrl}" alt="Ticket QR Code" width="220" height="220" style="width:220px;height:220px;display:block;margin:0 auto;border-radius:12px;background:#ffffff;">
              <div style="margin-top:14px;padding:6px 14px;background:#e2e8f0;border-radius:8px;display:inline-block;">
                <span style="font-size:13px;color:#1e293b;font-weight:700;letter-spacing:1.5px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;">${ticketReference}</span>
              </div>
            </div>
            <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">
              📎 A copy of the QR code is also attached to this email
            </p>
          </td>
        </tr>

        <!-- Event Details -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;">
                  <table width="100%" cellpadding="8" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:13px;width:110px;font-weight:500;">🎪 Event</td>
                      <td style="color:#0f172a;font-size:14px;font-weight:700;">${eventName}</td>
                    </tr>
                    ${eventDate ? `<tr>
                      <td style="color:#64748b;font-size:13px;font-weight:500;">📅 Date</td>
                      <td style="color:#0f172a;font-size:14px;font-weight:600;">${eventDate}</td>
                    </tr>` : ""}
                    ${eventVenue ? `<tr>
                      <td style="color:#64748b;font-size:13px;font-weight:500;">📍 Venue</td>
                      <td style="color:#0f172a;font-size:14px;font-weight:600;">${eventVenue}</td>
                    </tr>` : ""}
                    <tr>
                      <td style="color:#64748b;font-size:13px;font-weight:500;">🎫 Ref Code</td>
                      <td style="color:#2563eb;font-size:14px;font-weight:700;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;">${ticketReference}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- View Online Button -->
        <tr>
          <td align="center" style="padding:0 36px 28px;">
            <a href="${ticketUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
              Open Digital Pass Online →
            </a>
          </td>
        </tr>

        <!-- Instructions Notice -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                <strong>📋 Entry Reminder:</strong><br>
                Please keep your screen brightness high when presenting your QR code for rapid check-in.<br>
                Need assistance? Reach out to <a href="mailto:${supportEmail ?? "support@gdg.community"}" style="color:#2563eb;font-weight:600;text-decoration:none;">${supportEmail ?? "support@gdg.community"}</a>.
              </p>
            </div>
          </td>
        </tr>

        <!-- Professional Footer -->
        <tr>
          <td style="background:#f1f5f9;padding:28px 36px;text-align:center;border-top:1px solid #e2e8f0;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:10px;">
              <tr>
                <td style="padding:0 3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4285F4;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#EA4335;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#FBBC05;"></span></td>
                <td style="padding:0 3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34A853;"></span></td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#334155;font-weight:700;">
              Engineered & Developed by <span style="color:#2563eb;">Mohamed Tarek</span>
            </p>
            <p style="margin:0 0 10px;font-size:13px;color:#64748b;font-weight:500;">
              📞 <a href="tel:+201284621015" style="color:#2563eb;text-decoration:none;font-weight:600;">+20 128 462 1015</a>
            </p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              This official entry pass was automatically generated for ${eventName}.
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

View your digital pass online: ${params.ticketUrl}

Please present your QR code at the entrance on the day of the event.
(A copy of the QR code image is also attached to this email)

If you have any questions, contact us at: ${params.supportEmail ?? "support@gdg.community"}

--
Platform engineered & developed by Mohamed Tarek (+20 128 462 1015)
`;
}

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith("re_mock")) return null;
  return new Resend(apiKey);
}
