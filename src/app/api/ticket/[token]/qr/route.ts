import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { connectDB } from "@/lib/db";
import { Ticket, ITicket } from "@/models/Ticket";
import { hashToken } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    if (!token) {
      return new NextResponse("Token is required", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.gdgbns.online";
    const ticketUrl = `${appUrl}/ticket/${token}`;

    // Generate PNG buffer of the QR code
    const pngBuffer = await QRCode.toBuffer(ticketUrl, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 360,
      color: {
        dark: "#1a1f36",
        light: "#ffffff",
      },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="qr-${token.slice(0, 8)}.png"`,
      },
    });
  } catch (err) {
    console.error("Error generating QR image:", err);
    return new NextResponse("Failed to generate QR code", { status: 500 });
  }
}
