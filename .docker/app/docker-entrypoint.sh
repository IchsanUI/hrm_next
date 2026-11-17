#!/bin/sh
# Dijalankan tiap kali container app start — terapkan migrasi Prisma yang
# belum jalan (aman diulang berkali-kali, `migrate deploy` idempoten),
# baru start server. Cukup aman auto-run di sini karena setup ini SATU
# instance app saja (bukan banyak replika production yang bisa race
# menjalankan migrasi bersamaan).
#
# WAJIB menunggu MariaDB siap, BUKAN langsung keluar kalau gagal: mariadb &
# nginx menumpang network namespace container app (network_mode:
# service:app) dan baru start SETELAH app. Kalau app keluar karena database
# belum siap, Docker me-restart app dengan namespace BARU — mariadb tertinggal
# di namespace lama sehingga 127.0.0.1:3306 tidak akan pernah terjangkau dan
# app restart terus-menerus.
set -e

MAX_TRIES=${DB_WAIT_MAX_TRIES:-40}
i=0
echo "Menjalankan migrasi database (menunggu database siap)..."
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_TRIES" ]; then
    echo "Migrasi tetap gagal setelah $MAX_TRIES percobaan. Periksa log mariadb & DATABASE_URL."
    exit 1
  fi
  echo "Database belum siap atau migrasi gagal — coba lagi dalam 5 detik ($i/$MAX_TRIES)..."
  sleep 5
done

echo "Menjalankan server Next.js..."
exec npm run start
