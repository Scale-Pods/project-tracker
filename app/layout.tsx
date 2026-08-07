import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import { BackgroundGradient } from "@/components/ui/BackgroundGradient";
import "./globals.css";

const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Projects | ScalePods Tracker",
  description: "Automated project tracker dashboard for ScalePods.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ubuntu.variable} h-full`}>
      <body className="min-h-full antialiased">
        <BackgroundGradient />
        {children}
      </body>
    </html>
  );
}
