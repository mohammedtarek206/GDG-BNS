import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "GDG Event Platform",
  description: "Professional event management and QR check-in platform for Google Developer Groups",
  keywords: ["GDG", "Google Developer Groups", "event management", "QR check-in", "tickets"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1a1f36",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px",
              padding: "12px 16px",
            },
            success: {
              iconTheme: { primary: "#34A853", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#EA4335", secondary: "#fff" },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
