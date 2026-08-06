# Docker Deployment — HRIS (hrm-next)

Setup ini diadaptasi dari `Docker-Template` (Nginx + PHP-FPM + MariaDB) —
service `php` diganti total jadi service `app` berbasis Node/Next.js.
Perbedaan arsitektur dari template asli:

- `app` (dulu `php`) menjalankan Next.js sendiri (`npm run start` di port
  3000), bukan PHP-FPM lewat FastCGI.
- `nginx` jadi **reverse proxy** (`proxy_pass http://localhost:3000`),
  bukan `fastcgi_pass`.
- Trik `network_mode: service:app` dipertahankan — nginx & mariadb
  "menumpang" network namespace container `app`, jadi bisa saling akses
  lewat `localhost`.

## 1. Siapkan `.env`

```bash
cp .docker/.env.example .docker/.env
```

Isi semua nilai `ganti-ini` di `.docker/.env` — lihat komentar `#! TODO` di
tiap baris. **Jangan** pakai kredensial contoh untuk production.

## 2. Build & jalankan

```bash
docker compose -f .docker/docker-compose.yml up -d --build
```

Container `app` otomatis menjalankan `prisma migrate deploy` sebelum start
server tiap kali container dijalankan (lihat `.docker/app/docker-entrypoint.sh`)
— jadi migrasi database ter-apply otomatis, tidak perlu langkah manual.

## 3. Setelah jalan — atur Backup Manual

Buka `/admin/backup/manual` sebagai SUPER_ADMIN, isi field **"Lokasi
mysqldump.exe"** dengan:

```
/usr/bin/mysqldump
```

(binary `mysqldump` sudah terpasang di image `app` lewat `default-mysql-client`,
lihat `.docker/app/Dockerfile`).

## 4. HTTPS untuk production sungguhan

`.docker/nginx/Dockerfile` generate self-signed certificate otomatis saat
build — cukup untuk testing, TAPI browser akan menandai "Not Secure" untuk
pengguna asli. Untuk domain production:

- Ganti isi `.docker/nginx/data/ssl/server.crt` & `server.key` dengan
  certificate asli (mis. dari Let's Encrypt/Certbot), ATAU
- Mount certificate asli lewat volume tambahan di `docker-compose.yml`.

## 5. Volume yang WAJIB persisten

Jangan pernah `docker compose down -v` (menghapus volume) tanpa backup
manual dulu — tiga volume ini isinya data sungguhan:

| Volume | Isi |
|---|---|
| `mariadb_data` | Seluruh database |
| `app_storage_backups` | Hasil Backup Manual (lib/backup/run-backup.ts) |
| `app_public_uploads` | Foto pegawai, kop surat, bukti evidence, dll |

## 6. Update ke versi baru

```bash
git pull
docker compose -f .docker/docker-compose.yml up -d --build
```

Rebuild otomatis narik kode terbaru + jalankan migrasi baru (kalau ada)
lewat entrypoint. Volume di atas tidak ikut terhapus/ter-reset oleh proses
ini.

## 7. Dev — cuma MariaDB di container

`docker-compose-dev.yml` **beda tujuan** dari `docker-compose.yml` — di sini
cuma service `mariadb` yang jalan di container, Next.js-nya tetap native
(`npm run dev` di host seperti biasa). Berguna kalau mau tes koneksi ke
MariaDB (mesin DB yang sama seperti production) tanpa perlu instal MariaDB
langsung di Windows.

```bash
docker compose -f .docker/docker-compose-dev.yml up -d
```

Port 3306 di-expose ke host, jadi tinggal arahkan `DATABASE_URL` di `.env`
**root project** (bukan `.docker/.env`) ke:

```
DATABASE_URL=mysql://<MYSQL_USER>:<MYSQL_PASSWORD>@localhost:3306/<MYSQL_DATABASE>
```

(nilai `MYSQL_*` diambil dari `.docker/.env` yang sama — compose ini juga
baca file itu). Lalu jalankan seperti biasa:

```bash
npx prisma migrate deploy   # atau migrate dev kalau lagi develop schema
npm run dev
```

Volume `mariadb_dev_data` terpisah dari `mariadb_data` (punya
`docker-compose.yml`/production) — data dev dan production tidak akan
saling tertimpa.

## Referensi file

- `.docker/app/Dockerfile` — image Next.js (multi-stage: deps → builder → runner).
- `.docker/app/docker-entrypoint.sh` — jalankan migrasi lalu start server.
- `.docker/nginx/config/default.conf` — reverse proxy ke Next.js.
- `.docker/mariadb/config/my.cnf` — charset/collation MariaDB.
- `.docker/docker-compose.yml` — orkestrasi 3 container production (app, nginx, mariadb).
- `.docker/docker-compose-dev.yml` — cuma MariaDB, buat dev lokal (Next.js tetap native).
- `.docker/.env.example` — template variabel environment (copy jadi `.env`, dipakai kedua compose).
