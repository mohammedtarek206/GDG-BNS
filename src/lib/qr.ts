import QRCode from "qrcode";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Generates a QR code data URL for a ticket token.
 * The QR payload is a URL pointing to the public ticket verification page.
 * It contains only the random token – no personal data.
 */
export async function generateQRDataUrl(token: string): Promise<string> {
  const url = `${APP_URL}/ticket/${token}`;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: {
      dark: "#1a1f36",
      light: "#ffffff",
    },
  });
}

/**
 * Generates a QR code as SVG string.
 */
export async function generateQRSvg(token: string): Promise<string> {
  const url = `${APP_URL}/ticket/${token}`;
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
  });
}
