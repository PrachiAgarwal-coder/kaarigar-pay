import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaarigar Pay: AI-verified milestone escrow on PayPal",
  description: "A letter of credit for orders too small for a bank.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
