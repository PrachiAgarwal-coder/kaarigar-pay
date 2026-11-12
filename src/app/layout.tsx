import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaarigar Pay: get paid for every milestone",
  description:
    "Milestone payments for small exporters. The buyer's money is held by PayPal and released when AI verifies the seller's proof.",
};

export const viewport: Viewport = { themeColor: "#0f1647" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
