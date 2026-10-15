import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pantora — Speak Without Fear. Connect With the World.",
    template: "%s · Pantora",
  },
  description:
    "Pantora is a voice-first English speaking practice platform: low-pressure conversations, speaking battles, AI-assisted feedback, and streaks that keep you motivated.",
  applicationName: "Pantora",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#17123d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
