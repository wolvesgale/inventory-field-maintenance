'use client';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {/* 透かしロゴ - 全画面固定、操作に影響なし */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 9999,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: '28vw',
                fontWeight: 900,
                color: 'rgba(0, 0, 0, 0.07)',
                transform: 'rotate(-25deg)',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              Plus9
            </span>
          </div>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
