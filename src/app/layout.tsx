import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";

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
    <html lang="en">
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
