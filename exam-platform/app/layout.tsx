import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HKUST CSE Exam Platform",
  description:
    "Computer-based examination dashboard and proctoring system for HKUST CSE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
