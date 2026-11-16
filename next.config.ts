import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache filesystem Turbopack untuk `next dev` (default aktif sejak
    // Next 16.1) menumpuk di .next/dev sampai ±5,5 GB dan sudah dua kali
    // memenuhi disk D: — Turbopack lalu gagal menulis & SEMUA halaman error
    // "An unexpected Turbopack error occurred". Dimatikan: dev start sedikit
    // lebih lambat, tapi disk aman. Hapus baris ini kalau ruang disk sudah longgar.
    turbopackFileSystemCacheForDev: false,
    serverActions: {
      // Dinaikkan dari 5mb — form Lengkapi Hasil Lembur bisa kirim sampai 5
      // foto sekaligus (dikompres di browser dulu, tapi tetap perlu headroom).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
