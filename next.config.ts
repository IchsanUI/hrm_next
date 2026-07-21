import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Dinaikkan dari 5mb — form Lengkapi Hasil Lembur bisa kirim sampai 5
      // foto sekaligus (dikompres di browser dulu, tapi tetap perlu headroom).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
