import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const fontSans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Yatra — Plan your next trip",
  description:
    "Bring together your destination's weather, local places, and currency details in one thoughtful travel plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
