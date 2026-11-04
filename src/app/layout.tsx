import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { DisclaimerBanner } from "@/components/Disclaimer";
import { Header } from "@/components/Header";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "AI Finance Assistant", template: "%s · AI Finance Assistant" },
  description: "Jarvis-style stock research chat and a paper-trading portfolio. Educational only, not financial advice.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e13" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may add class="dark" before React hydrates.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <DisclaimerBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Built as a student portfolio project. Not investment advice. Prices via Yahoo Finance (unofficial, may be delayed).
        </footer>
        <ChatPanel />
      </body>
    </html>
  );
}
