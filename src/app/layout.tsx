import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { getUiScale } from "@/server/services/ui-scale";
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
    default: "YAAS Nova",
    template: "%s · Nova",
  },
  description:
    "Nova is the YAAS workspace for tasks, calendars and everything your team owes each other.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolved on the server so the first paint is already at the right scale.
  // Setting it from an effect would land every page on medium and then jump.
  const uiScale = await getUiScale();

  return (
    <html lang="en" className="dark" data-ui-scale={uiScale}>
      <body
        className={`${geistSans.variable} ${spaceGrotesk.variable} font-sans`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}