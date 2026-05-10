import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "InvenPOS", template: "%s | InvenPOS" },
  description: "Enterprise Inventory & POS Management System",
  keywords: ["inventory", "POS", "cashier", "stock management", "sales"],
  authors: [{ name: "InvenPOS" }],
  openGraph: {
    type: "website",
    title: "InvenPOS",
    description: "Enterprise Inventory & POS Management System",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
