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

// Script blocking kecil di <head> — dijalankan browser SEBELUM sempat
// menggambar apa pun, jadi class "dark" (kalau memang preferensinya gelap)
// sudah terpasang sebelum first paint. Tanpa ini, halaman selalu digambar
// terang dulu (karena server tidak tahu localStorage), baru "berkedip" ke
// gelap setelah ThemeProvider jalan di client — lihat components/theme-provider.tsx
// (STORAGE_KEY di sana HARUS tetap sinkron dengan "theme" di sini).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "system";
    var resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    if (resolved === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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
