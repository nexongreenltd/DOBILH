import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-sora", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "DoB Innovation & Learning Hub", template: "%s · DoB Innovation & Learning Hub" },
  description:
    "Online, offline and hybrid courses from Dreams of Bangladesh — live classes, daily resources, assessments, certificates and an AI learning assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
