import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IntentLock - AI Shopping Authorization",
  description: "AI-powered transaction intent and authorization engine that protects your purchases",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        <Suspense fallback={<div className="h-16 border-b border-gray-200 bg-white" />}>
          <Header />
        </Suspense>
        <main className="flex-1">
          <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </body>
    </html>
  );
}
