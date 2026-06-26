import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal & Pricing Governance Reviewer",
  description: "Deterministic policy engine with AI exception review for freight pricing governance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
