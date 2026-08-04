import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nova by YAAS",
    template: "%s · Nova",
  },
  description:
    "Nova is the YAAS workspace for tasks, calendars and everything your team owes each other.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${spaceGrotesk.variable} font-sans`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}