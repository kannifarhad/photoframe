import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const harmony = localFont({
  src: "../../public/harmony-font/Harmony-rvG68.otf",
  variable: "--font-clock",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Dashboard",
  description: "Full-screen kiosk dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${harmony.variable} h-full overflow-hidden scrollbar-none antialiased`}
    >
      <body className="h-full overflow-hidden scrollbar-none">{children}</body>
    </html>
  );
}
