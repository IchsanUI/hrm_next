#!/bin/sh
# Dijalankan tiap kali container app start — terapkan migrasi Prisma yang
# belum jalan (aman diulang berkali-kali, `migrate deploy` idempoten),
# baru start server. Cukup aman auto-run di sini karena setup ini SATU
# instance app saja (bukan banyak replika production yang bisa race
# menjalankan migrasi bersamaan).
set -e

echo "Menjalankan migrasi database..."
npx prisma migrate deploy

echo "Menjalankan server Next.js..."
exec npm run start
