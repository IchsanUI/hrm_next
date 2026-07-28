import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ToastListener } from "@/components/toast-listener";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HRIS",
  description: "Sistem HRIS (Human Resource Information System) & Absensi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HRIS",
  },
};

export const viewport: Viewport = {
  themeColor: "#172554",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <ToastListener />
          <Toaster position="top-right" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
