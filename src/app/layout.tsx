import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetly — Video meetings for everyone",
  description:
    "Secure, high-quality video meetings. Create a meeting and share the link to connect with anyone, anywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
