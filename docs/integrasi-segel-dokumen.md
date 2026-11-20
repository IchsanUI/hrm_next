# Integrasi Layanan Segel Dokumen (QR TTD Digital & Stempel)

| | |
|---|---|
| **Status** | Draf kontrak v1 — sisi HRIS sudah siap, layanan segel belum dibangun |
| **Pemilik** | EDP/IT Perumda BPR Bank Gresik |
| **Kode HRIS** | `lib/document-seal/`, `app/api/integrations/segel-dokumen/webhook/route.ts`, tabel `document_seals` |

## 1. Gambaran

Layanan Segel Dokumen adalah sistem terpisah yang menjadi **satu-satunya penerbit QR** tanda tangan digital dan stempel untuk sistem internal (HRIS, Pengajuan Kredit, dan lainnya). Sistem peminta tidak membuat QR verifikasi sendiri. Sistem peminta:

1. mengirim **permintaan segel** berisi identitas dokumen, sidik isi (hash), dan penanda tangan;
2. menerima **QR payload** (biasanya URL verifikasi) dan menempelkannya ke PDF miliknya;
3. menerima **callback** saat segel yang menunggu persetujuan terbit, ditolak, atau dicabut.

Orang yang memindai QR membuka **halaman verifikasi di layanan segel**. Halaman itu menampilkan status segel (sah/dicabut), penanda tangan, waktu terbit, dan ringkasan dokumen.

```
HRIS ──POST /v1/seals──────────────▶ Layanan Segel ──(persetujuan pejabat, bila perlu)
  ▲                                      │
  └──── POST {callbackUrl} (seal.issued / seal.rejected / seal.revoked)
Pemindai QR ──▶ https://segel…/v/{id}  (halaman verifikasi publik)
```

### Jenis segel

| `kind` | Arti | `signer.ref` |
|---|---|---|
| `SIGNATURE` | TTD digital atas nama pejabat. Boleh butuh persetujuan pejabat (PIN/OTP) di layanan segel, jadi bisa `PENDING` dulu. | NIP pejabat |
| `STAMP` | Stempel instansi/bagian. Biasanya langsung `ISSUED`. | Kode stempel terdaftar, mis. `SDM` |

## 2. Autentikasi (HMAC, dua arah)

Setiap permintaan, dari HRIS ke layanan maupun callback dari layanan ke HRIS, membawa header:

| Header | Isi |
|---|---|
| `X-Seal-Client` | ID klien, mis. `hris` (hanya arah peminta → layanan) |
| `X-Seal-Timestamp` | Waktu dalam detik Unix |
| `X-Seal-Signature` | `hex(HMAC-SHA256(secret, timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)))` |

- `path` adalah pathname beserta query string, mis. `/v1/seals/abc/revoke`. Untuk GET, body berupa string kosong.
- Tolak permintaan bila selisih waktu lebih dari **300 detik**. Bandingkan tanda tangan dengan perbandingan *constant-time*.
- Setiap klien punya secret sendiri. Callback memakai `SEAL_WEBHOOK_SECRET`; jika tidak diisi, dipakai secret klien.
- Implementasi acuan: `lib/document-seal/http.ts` (`computeSealSignature`, `verifySealSignature`).

## 3. Endpoint yang harus disediakan layanan segel

### 3.1 `POST /v1/seals` — minta segel

```json
{
  "clientReference": "Yq3k0d1Pz8mVb2Tq",
  "sourceType": "PAYSLIP",
  "sourceId": "123",
  "documentType": "Slip Gaji",
  "documentNumber": "SLIP-202605-000123",
  "title": "Slip Gaji Budi Santoso — 21 Apr 2026 s/d 20 Mei 2026",
  "kind": "STAMP",
  "signer": { "ref": "SDM", "name": "Bagian SDM" },
  "contentDigest": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "summary": [
    { "label": "Nomor Slip", "value": "SLIP-202605-000123" },
    { "label": "Pegawai", "value": "Budi Santoso (0123)" }
  ],
  "callbackUrl": "https://hris.bankgresik.co.id/api/integrations/segel-dokumen/webhook"
}
```

- **Idempoten** berdasarkan `(X-Seal-Client, clientReference)`. Permintaan ulang dengan `clientReference` yang sama mengembalikan segel yang sama, bukan segel baru.
- `contentDigest` adalah SHA-256 dari JSON kanonik (kunci terurut) berisi data penting dokumen. Simpan nilainya; jangan ditampilkan sebagai data rahasia.
- `summary` ditampilkan di halaman verifikasi. Peminta hanya mengirim data yang boleh dilihat publik.

Respons `200`/`201`:

```json
{
  "id": "SG-2026-000981",
  "status": "ISSUED",
  "verifyUrl": "https://segel.bankgresik.co.id/v/SG-2026-000981",
  "qrPayload": "https://segel.bankgresik.co.id/v/SG-2026-000981",
  "issuedAt": "2026-11-20T09:15:00Z"
}
```

`status` bernilai `ISSUED`, `PENDING`, `REJECTED`, atau `REVOKED`. Selama `PENDING`, `verifyUrl` dan `qrPayload` boleh `null`. `qrPayload` adalah teks yang dikodekan ke QR; jika kosong, HRIS memakai `verifyUrl`.

### 3.2 `GET /v1/seals/{id}` — status terbaru

Bentuk responsnya sama dengan 3.1, ditambah `reason` bila ditolak atau dicabut. HRIS memanggil endpoint ini paling sering sekali per menit per segel yang masih `PENDING`, sebagai cadangan bila callback terlambat.

### 3.3 `POST /v1/seals/{id}/revoke` — cabut segel

Body: `{ "reason": "Slip dikoreksi" }`. Responsnya objek segel dengan `status: "REVOKED"`. Setelah dicabut, halaman verifikasi harus menampilkan **DICABUT** beserta alasannya.

### 3.4 Format galat

Status 4xx/5xx dengan body `{ "error": { "code": "SIGNER_NOT_FOUND", "message": "Kode stempel tidak dikenal" } }`. HRIS menyimpan `message` di kolom `errorMessage` dan menandai segel `FAILED`.

## 4. Callback ke peminta

`POST {callbackUrl}` dengan header HMAC (bagian 2, tanpa `X-Seal-Client`):

```json
{
  "event": "seal.issued",
  "seal": {
    "id": "SG-2026-000981",
    "clientReference": "Yq3k0d1Pz8mVb2Tq",
    "status": "ISSUED",
    "verifyUrl": "https://segel.bankgresik.co.id/v/SG-2026-000981",
    "qrPayload": "https://segel.bankgresik.co.id/v/SG-2026-000981",
    "issuedAt": "2026-11-20T09:15:00Z",
    "reason": null
  }
}
```

- `event` bernilai `seal.issued`, `seal.rejected`, atau `seal.revoked`.
- HRIS membalas `200 { "ok": true }`. Balasan lain (401/404/5xx) perlu dikirim ulang dengan jeda bertahap (mis. 1, 5, 30 menit, lalu 2 jam).
- HRIS menolak callback jika `seal.id` tidak sama dengan id yang tercatat untuk `clientReference` tersebut.

## 5. Perilaku di sisi HRIS

| Kondisi | Hasil di PDF |
|---|---|
| `SEAL_SERVICE_URL` belum diisi | QR lama (perilaku sebelum integrasi) |
| Segel `ISSUED` | QR dari `qrPayload` layanan |
| `PENDING` / `FAILED` / `REJECTED` | QR lama selama masa transisi; segel `FAILED` dicoba ulang saat dokumen dicetak lagi |
| `REVOKED` | QR lama, atau tanpa QR bila dokumen tidak punya QR cadangan |
| Isi dokumen berubah (digest beda) | Permintaan segel baru |

Segel disimpan di tabel `document_seals` dan dipakai ulang, jadi mencetak ulang dokumen tidak membuat segel baru.

### Titik integrasi saat ini

| `sourceType` | Dokumen | Kapan disegel |
|---|---|---|
| `PAYSLIP` | Slip Gaji (`app/api/payroll/slip-gaji/[id]/pdf`) | Periode payroll sudah **LOCKED** |
| `HEALTH_CLAIM_MEMO` | Nota Dinas Klaim Kesehatan (`app/api/klaim-kesehatan/nota-dinas/[publicId]/pdf`) | Nota Dinas **final** (disetujui/dibayar) |

Rencana berikutnya: surat-surat modul Administrasi SDM (SKK, SP, Perjanjian Kerja).

### Menambah dokumen baru yang butuh QR

1. Tambahkan entri di `lib/document-seal/registry.ts` (label, `kind`, penanda tangan bawaan).
2. Di route pembuat PDF, panggil:

   ```ts
   const qr = await getDocumentQr(
     { sourceType: "…", sourceId, documentNumber, title, content: { /* data penting */ }, summary: [/* data publik */] },
     { fallbackPayload: null }
   )
   // qr.dataUrl → gambar PNG untuk <Image> react-pdf; null = belum ada QR
   ```

3. Saat dokumen dibatalkan atau dikoreksi, panggil `revokeDocumentSeals(sourceType, sourceId, alasan)`.
4. Untuk TTD pejabat tertentu, kirim `signer: { kind: "SIGNATURE", ref: nipPejabat, name }`.

## 6. Konfigurasi HRIS (`.env`)

| Variabel | Contoh | Keterangan |
|---|---|---|
| `SEAL_SERVICE_URL` | `https://segel.bankgresik.co.id` | Kosong = integrasi nonaktif |
| `SEAL_CLIENT_ID` | `hris` | |
| `SEAL_CLIENT_SECRET` | *(rahasia)* | Minimal 32 karakter acak |
| `SEAL_WEBHOOK_SECRET` | *(rahasia)* | Opsional; default = `SEAL_CLIENT_SECRET` |
| `SEAL_TIMEOUT_MS` | `8000` | Batas waktu per permintaan |
| `APP_PUBLIC_URL` | `https://hris.bankgresik.co.id` | Dasar `callbackUrl`; default `AUTH_URL` |

Endpoint callback `/api/integrations/segel-dokumen/webhook` tidak butuh sesi login. Jika ada aturan Cloudflare/nginx yang membatasi `/api`, endpoint ini harus dibuka untuk alamat IP layanan segel.

## 7. Saran untuk layanan segel

- **Halaman verifikasi publik** menampilkan status, jenis segel, penanda tangan, waktu terbit, `documentNumber`, dan `summary`. Opsional: unggah PDF untuk dicocokkan dengan `contentDigest` atau hash file.
- **Persetujuan TTD pejabat** memakai PIN/OTP per pejabat, dengan daftar antrean persetujuan.
- **Registri stempel** berisi kode, nama, gambar stempel, dan klien mana yang boleh memakainya.
- **Log audit** mencatat setiap permintaan, persetujuan, pencabutan, dan pemindaian.
- **ID segel** tidak berurutan dan tidak mudah ditebak di URL verifikasi.
