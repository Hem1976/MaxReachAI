import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_SUBTITLE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Internal AI sales outreach workspace for Maxpro Infotech. Runs locally against Ollama.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider delayDuration={250}>
          <div className="flex min-h-dvh flex-col lg:flex-row">
            <AppSidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
