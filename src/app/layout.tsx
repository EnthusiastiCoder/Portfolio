import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import MotionProvider from "@/components/MotionProvider";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import RainLoader from "@/components/matrix/RainLoader";
import { matrixTheme } from "@/config/theme";
import { siteConfig } from "@/config/site";
import { effectsBootScript } from "@/lib/effects";
import { pillBootScript } from "@/lib/pill";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.title, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: matrixTheme.colors.background,
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The boot scripts set data-effects and data-pill before paint; React must not complain.
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: effectsBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: pillBootScript }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="scroll-progress" aria-hidden="true" />
        <SiteHeader />
        <MotionProvider>
          <div className="flex-1">{children}</div>
        </MotionProvider>
        <SiteFooter />
        <RainLoader />
      </body>
    </html>
  );
}
