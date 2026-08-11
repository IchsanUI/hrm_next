# Image Node buat app HRIS ini — dibangun dari template PHP-FPM/Nginx/MariaDB
# di Docker-Template, tapi service "php" diganti total jadi service Node
# (Next.js jalan sebagai server sendiri, bukan FastCGI kayak PHP-FPM).
#
# SENGAJA TIDAK pakai `output: "standalone"` Next.js (image jadi lebih besar
# dari seharusnya) — soalnya fitur Backup Manual (lib/backup/run-backup.ts)
# butuh Prisma CLI (`npx prisma migrate deploy`) tetap tersedia di image
# akhir buat migrasi saat deploy, dan standalone output tidak ikut
# nge-bundle package `prisma` (cuma @prisma/client runtime-nya). Trade-off:
# image lebih besar, tapi jauh lebih gampang dan reliable dipelihara.

# ---- deps: install semua dependency sekali, di-cache terpisah dari source code ----
FROM node:20-slim AS deps
WORKDIR /app
# openssl dibutuhkan Prisma buat deteksi target engine saat generate/build.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate Prisma Client + build Next.js ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npx prisma generate
RUN npm run build

# ---- runner: image final yang benar-benar dijalankan production ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# default-mysql-client — nyediakan binary `mysqldump` buat fitur Backup
# Manual (lib/backup/run-backup.ts). Path-nya nanti diisi admin lewat UI
# Pengaturan Backup: /usr/bin/mysqldump.
RUN apt-get update \
  && apt-get install -y --no-install-recommends default-mysql-client openssl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/instrumentation.ts ./instrumentation.ts
COPY .docker/app/docker-entrypoint.sh ./docker-entrypoint.sh

# storage/backups (dump database), storage/dokumen-pegawai (KTP/KK/NPWP/dst,
# lib/employee-document-storage.ts), & public/uploads (foto pegawai dll) —
# di-mount sebagai volume lewat docker-compose.yml, dibuat di sini dulu
# supaya kepemilikannya benar sebelum volume di-mount di atasnya.
RUN mkdir -p storage/backups storage/dokumen-pegawai public/uploads \
  && chown -R nextjs:nodejs storage public/uploads .next \
  && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
