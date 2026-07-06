import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "WardFlow — Hospital Ward Portal",
  description:
    "Demonstration hospital ward portal for coordinating vitals, alerts, tasks, and medications. Fictional data only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable}`}>
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
