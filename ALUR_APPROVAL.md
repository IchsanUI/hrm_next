# Alur Approval — HRIS BPR Gresik

Dokumen ini menjelaskan secara detail bagaimana sistem persetujuan (approval) pengajuan izin/cuti bekerja: model data, logika penentuan approver, mesin status (state machine), mekanisme khusus (pegawai pengganti, dua-tahap lembur, dsb.), serta rute API dan halaman terkait.

Sumber kebenaran teknis: `src/lib/leave-request-service.ts`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/schemas/leave-request.ts`, `src/lib/notificationRouting.ts`, `src/components/approvals/*`.

---

## 1. Model Data Inti

```
ApprovalFlow (1) ──< ApprovalStep (banyak, berurutan)
     │                      │
     │                      └──< LeaveRequestApproval (baris approval per step per pengajuan)
     │
     └──< LeaveRequest (pengajuan izin/cuti)
                │
                └──< LeaveRequestApproval
                └──< LeaveRequestAttachment
```

### `ApprovalFlow` (`approval_flows`)
Satu "alur/skema approval" untuk satu jenis izin.
- `leaveType` — kunci pemilihan alur (lihat §2). **Bukan relasi**, cuma string yang harus cocok dengan tipe izin.
- `departmentId` — kolom ada di schema tapi **tidak dipakai** di logika manapun saat ini (pemilihan alur murni berdasarkan `leaveType`, tidak per departemen). Kemungkinan disiapkan untuk fitur alur berbeda per departemen di masa depan.
- `isActive` — hanya alur aktif yang dipakai.

### `ApprovalStep` (`approval_steps`)
Satu langkah/tahap dalam alur, punya urutan (`order`) dan tipe approver (`approverType`).
- `approverRef` — hanya dipakai kalau `approverType = "specific_user"` (isinya id Employee tujuan).
- `unlocksAction` — flag khusus, lihat §9.
- `condition` — ada di schema, **tidak dibaca di manapun** saat ini (field mati/reserved).

### `LeaveRequestApproval` (`leave_request_approvals`)
Satu baris approval = satu tindakan yang diharapkan dari satu approver pada satu step untuk satu pengajuan. Riwayat lengkap tersimpan — baris lama **tidak pernah ditimpa**, baris baru dibuat setiap kali step berpindah atau pengajuan diajukan ulang.

### `LeaveRequest` (`leave_requests`)
Pengajuan itu sendiri. `currentStep` (angka urutan step yang sedang aktif) dan `status` adalah dua sumber kebenaran utama untuk "posisi" pengajuan dalam alur.

---

## 2. Pemilihan Alur Approval — `resolveFlowForRequest(type)`

```
prisma.approvalFlow.findFirst({
  where: { leaveType: type, isActive: true },
  orderBy: { createdAt: "desc" },
})
```

- Dipanggil sekali di awal `createLeaveRequest`.
- Kalau ada lebih dari satu alur aktif untuk jenis izin yang sama, **yang paling baru dibuat yang dipakai** (tidak ada constraint DB yang memastikan cuma satu alur aktif per jenis — ini konvensi, bukan dijamin sistem).
- Kalau tidak ada alur aktif sama sekali untuk 5 jenis izin baru (lihat §17), sistem **otomatis membuatnya** lewat `ensureDefaultFlowsSeeded()` sebelum query di atas dijalankan (self-healing seed, idempotent).
- Kalau tetap tidak ditemukan alur/step → pengajuan ditolak dengan error `VALIDATION`.

---

## 3. Resolusi Approver — `resolveApproverEmployeeId()`

Setiap step punya `approverType`. Berikut cara masing-masing tipe diterjemahkan menjadi satu `Employee.id` nyata:

| `approverType` | Cara resolusi | Kasus gagal |
|---|---|---|
| `direct_manager` | `applicant.managerId` langsung | Error jika pegawai belum punya atasan (`"Pegawai belum memiliki atasan langsung. Hubungi HR."`) |
| `department_head` | Cari `Employee` di departemen yang sama, `isDepartmentHead=true`, **bukan** pemohon sendiri, user aktif | Error jika tidak ada kepala departemen terdaftar |
| `pegawai_pengganti` | `applicant.substituteEmployeeId` (dipilih pemohon saat submit) | Error jika tidak ada substitute — seharusnya sudah difilter oleh logika skip (§4) |
| `hr` | Prioritas: pegawai `isDepartmentHead=true` + role `hr_admin`/`hr_staff` ("Kabag Personalia") → fallback ke `hr_admin` aktif manapun → fallback ke `hr_staff` aktif manapun | Error jika tidak ada satupun akun HR aktif |
| `direksi` | Menyusuri rantai `managerId` ke atas (maksimal 10 langkah, dijaga dari infinite loop) mencari leluhur terdekat dengan role `direksi` yang aktif; kalau gagal, fallback ke direksi aktif manapun di sistem | Ini yang membedakan rantai Direktur Utama (Audit Internal/Kepatuhan) vs Direktur (Operasional/Marketing/Personalia/Legal/Litbang) — murni dari data `managerId`, tanpa konfigurasi tambahan |
| `specific_user` | Langsung dari `step.approverRef` | Error jika `approverRef` kosong |

### Logika Skip Step — `isStepSkipped()` / `getEffectiveSteps()`

Sebelum daftar step dipakai (baik saat membuat pengajuan baru maupun saat lanjut ke step berikutnya), daftar step "mentah" dari alur disaring dulu jadi **effective steps** berdasarkan konteks pemohon saat itu:

1. `direct_manager` **di-skip** kalau pemohon sendiri adalah kepala departemen (kepala departemen tidak punya atasan langsung dalam rantai normal).
2. `department_head` **di-skip** kalau pemohon sendiri kepala departemen (tidak mungkin approve pengajuan sendiri).
3. `hr` **di-skip** khusus untuk `cuti` kalau durasinya ≤ 3 hari kerja (cuti pendek tidak perlu tanda tangan HR).
4. `pegawai_pengganti` **di-skip** kalau pemohon tidak memilih pengganti (field ini opsional di form).

Semua navigasi `currentStep`/step berikutnya **selalu** beroperasi di atas daftar effective steps ini, bukan daftar mentah dari `ApprovalFlow`.

---

## 4. Pembuatan Pengajuan — `createLeaveRequest`

Urutan validasi (lengkap, dijalankan berurutan, berhenti di kegagalan pertama):

1. Pastikan sesi terhubung ke data `Employee` (kalau tidak → `FORBIDDEN`).
2. **Validasi umum** (`validateLeaveRequestInput`, dipakai bersama juga oleh alur "ajukan ulang dengan edit detail" di §7):
   - Tanggal tidak boleh di masa lalu (kecuali jenis `sakit`, `terlambat`, `dispensasi` yang memang wajar dilaporkan mundur).
   - Khusus Lembur: tanggal harus hari ini (sebelum jam 17:00) atau masa depan — divalidasi ulang di server supaya tidak bisa dilewati dari client.
   - `endDate >= startDate`.
   - Cek hari libur: untuk jenis izin **selain** cuti/lembur/cuti-cuti panjang (`cuti`, `lembur`, `cuti_bersalin`, `cuti_besar`, `cuti_luar_tanggungan`, `cuti_khusus`), tanggal yang jatuh di hari libur dengan kantor tutup penuh (`officeOpen=false`) akan **ditolak**. Jenis cuti/lembur dikecualikan karena wajar melintasi hari libur.
   - Saldo Cuti Tahunan: hitung hari kerja efektif (`calculateCutiDays`, mengecualikan akhir pekan & hari libur), harus > 0 dan tidak melebihi saldo tahun berjalan (`LeaveBalance.remainingDays`) → kalau kurang, error `INSUFFICIENT_BALANCE`.
   - Cuti Besar (masa kerja ≥ 6 tahun) / Cuti Di Luar Tanggungan (≥ 10 tahun): digerbang oleh masa kerja. Cuti Besar juga membuat/membaca kuota siklus 6 tahunan (60 hari per siklus, `LeaveEntitlement`, `cycleKey="cycle-N"`). Cuti Luar Tanggungan dibatasi maksimal 92 hari kalender (tanpa entitlement row, cuma batas hari).
   - Cuti Khusus (Haji/Umroh): batas hari (40 hari haji / 20 hari umroh); entitlement seumur hidup (`cycleKey="lifetime"`, kuota 1) — hanya bisa dipakai sekali seumur bekerja.
   - Cuti Bersalin: batas hari (92 hari melahirkan / 45 hari gugur kandungan).
   - Dispensasi: batas hari sesuai kategori (`DISPENSATION_CATEGORIES`).
3. Ambil alur approval (`resolveFlowForRequest`, §2) — gagal kalau tidak ada alur/step.
4. Ambil data pemohon (`managerId`, `isDepartmentHead`, `departmentId`, nama).
5. Untuk `cuti`/`sakit` dengan `substituteEmployeeId`: validasi ulang di server (`resolveSubstituteInfo`) — pengganti harus di departemen yang sama dan bukan diri sendiri (dropdown di form sudah difilter, tapi tetap dicek ulang di server).
6. Hitung `SkipContext`, saring jadi effective steps, ambil step pertama.
7. Resolusi approver step pertama (§3).
8. Susun payload JSON sesuai jenis izin (`extractJsonFields`), sisipkan info pengganti, snapshot kuota entitlement (dipakai nanti untuk pengurangan saat approval final), dan metadata geofencing untuk `terlambat`/`lembur` (§8).
9. Di dalam satu transaksi database:
   - Buat `LeaveRequest` (`status: "pending"`, `currentStep = step pertama`).
   - Buat baris `LeaveRequestApproval` pertama (`status: "pending"`).
   - Kirim notifikasi ke approver pertama (`leave_request_submitted`).

Catatan: `actionUnlockedAt` **tidak** diset saat pembuatan — hanya diisi ketika step yang ditandai `unlocksAction` disetujui (§9).

---

## 5. Aksi Approve / Reject / Revise — Mesin Status

Semua tindakan approver (`approveLeaveRequest`, `rejectLeaveRequest`, `reviseLeaveRequest`) memanggil satu fungsi inti: `actOnCurrentStep(session, requestId, actionStatus, notes)`.

### Langkah di dalam transaksi

1. Ambil pengajuan beserta `employee`, `flow.steps`, `approvals`.
2. **Guard**: kalau `status` pengajuan bukan `"pending"`, tolak (tidak bisa bertindak pada pengajuan yang sudah final/revisi/ditolak/disetujui).
3. Cari baris approval `pending` yang cocok dengan `currentStep` (penting: setelah siklus revisi+ajukan ulang, satu `stepOrder` bisa punya banyak baris riwayat — hanya yang `status="pending"` yang relevan).
4. Validasi approver: baris itu harus milik user yang login (`approverId` cocok) dan masih `pending`.
5. **Update atomik dengan optimistic lock**: `updateMany` dengan syarat `status masih "pending"` — kalau `count === 0` berarti ada orang lain yang sudah bertindak lebih dulu (race condition) → error `"Pengajuan sudah diproses oleh orang lain. Refresh halaman."`.
6. Cabang berdasarkan hasil tindakan:

#### a. `rejected` (Ditolak) / `revised` (Perlu Revisi)
- `LeaveRequest.status` diset `"rejected"` atau `"revisi"` — final untuk siklus ini.
- **Aturan khusus**: kalau ditolak (`rejected`) DAN jenisnya `sakit` DAN yang menolak adalah atasan langsung (`approverType="direct_manager"`) → otomatis dikonversi jadi Cuti Tahunan (§6).
- Notifikasi ke pemohon: `leave_request_rejected` / `leave_request_revised`.

#### b. `approved` (Disetujui)
- Hitung ulang effective steps (skip context bisa berubah kalau data pemohon berubah), cari step berikutnya setelah step saat ini.
- Kalau step yang baru disetujui punya `unlocksAction: true` → stempel `actionUnlockedAt` (§9).
- **Kalau tidak ada step berikutnya** (step terakhir disetujui): `status` jadi `"approved"`. Efek samping otomatis:
  - Cuti Tahunan → kurangi saldo (`decrementLeaveBalance`).
  - Cuti Besar → kurangi kuota siklus 6-tahunan **dan** nolkan sisa saldo cuti tahunan tahun itu (sesuai Pasal 38 ayat 2 — cuti besar menggugurkan sisa cuti tahunan tahun berjalan).
  - Cuti Khusus (haji/umroh) → kurangi kuota seumur hidup (jadi 0, tidak bisa dipakai lagi).
  - Notifikasi ke pemohon: `leave_request_approved`.
- **Kalau masih ada step berikutnya**: resolusi approver step tsb, `currentStep` pindah ke step itu, buat baris approval `pending` baru, kirim notifikasi `leave_request_submitted` ke approver baru.

### Ringkasan nilai status

**`LeaveRequest.status`**: `pending`, `approved`, `rejected`, `revisi`.
> Ada juga `cancelled` dan `finished` di peta label UI (`ApprovalCenterList.tsx`), tapi **tidak ada satupun fungsi backend yang pernah menyetel nilai ini** — kemungkinan reserved untuk fitur mendatang atau ditangani di luar file yang diperiksa. Perlu dikonfirmasi ke tim sebelum dianggap fitur aktif.

**`LeaveRequestApproval.status`**: `pending`, `approved`, `rejected`, `revised` (perhatikan: level pengajuan pakai kata `"revisi"`, level baris approval pakai `"revised"` — memang sengaja beda kosakata), dan `reassigned` (khusus dari pengalihan manual HR, §10).

---

## 6. Konversi Otomatis: Sakit Ditolak → Cuti Tahunan

`autoConvertSickToCuti` — hanya terpicu kalau **atasan langsung** (bukan HR/Direksi) menolak pengajuan Sakit.

- Membuat `LeaveRequest` **baru** bertipe `cuti`, langsung berstatus `"approved"` (final, `currentStep: 0`), pakai alur cuti yang aktif.
- `convertedFromRequestId` menunjuk balik ke pengajuan sakit asli (jejak audit).
- Langsung mengurangi saldo cuti tahunan tahun itu.
- Kirim notifikasi `sick_leave_auto_converted`.
- Ini **melewati** alur approval normal sama sekali — bukan pengajuan baru yang pending, tapi efek samping langsung dalam transaksi yang sama.

---

## 7. Ajukan Ulang Setelah Revisi — `resubmitLeaveRequest`

Hanya berlaku kalau `status === "revisi"`. Dua jalur, dibedakan dari isi payload:

### a. Jalur "pegawai pengganti menyatakan tidak bersedia"
Kalau step yang minta revisi bertipe `pegawai_pengganti` dan pemohon mengirim `newSubstituteEmployeeId`:
- Validasi pengganti baru (departemen sama, bukan diri sendiri).
- **Dialihkan ke orang baru** — tidak masuk akal mengirim ulang ke orang yang baru saja menolak.
- Notifikasi berbeda: "Anda Ditunjuk sebagai Pegawai Pengganti" (bukan notifikasi ajukan-ulang biasa).

### b. Jalur "edit detail pengajuan"
Kalau pemohon mengirim `updatedInput` (jenis izin harus sama dengan yang asli — tidak bisa ganti jenis saat resubmit):
- Menjalankan ulang **seluruh** `validateLeaveRequestInput` — persis sama seperti pengajuan baru (hari libur, saldo, entitlement, batas durasi semuanya divalidasi ulang).
- Membangun ulang payload JSON/tanggal/alasan/`attachmentCategory`.

Untuk kedua jalur: `status` kembali ke `"pending"`, dibuat baris `LeaveRequestApproval` **baru** di `stepOrder`/`stepId` yang **sama** (baris lama berstatus `"revised"` tetap disimpan sebagai riwayat, tidak ditimpa), lalu kirim notifikasi.

---

## 8. Geofencing — Informasi, Bukan Gerbang

`getEmployeeOfficeDistance(employeeId, lat, lng)` menghitung jarak dari titik yang diberikan ke **kantor tempat pegawai itu terdaftar** (bukan kantor terdekat), lalu dibandingkan dengan `geofenceRadius` kantor tersebut. Mengembalikan `null` kalau kantor belum punya koordinat (artinya "tidak bisa dihitung", bukan "ditolak").

**Penting: geofencing di sistem ini murni informasi untuk approver, tidak pernah memblokir submission atau approval.**

Dua pemakaian:

1. **Izin Terlambat**:
   - Saat submit: lokasi direkam sebagai titik pembanding saja (belum dicek radius — pegawai memang masih dalam perjalanan).
   - Saat check-in (upload foto bukti, `category="photo_evidence"`): `actualArrivalAt` selalu distempel; kalau ada koordinat, `arrivalVerified` diisi `true`/`false` sesuai radius; kalau tidak ada koordinat, tetap `null`. Ini **tidak pernah** memblokir upload atau approval — cuma metadata untuk pertimbangan approver.
2. **Izin Lembur**: saat submit, kalau ada koordinat, dihitung jarak dan disimpan `withinOffice: true/false/null` di `overtimePlan.location`. Di luar radius **tetap tercatat apa adanya**, tidak diblokir.

---

## 9. `unlocksAction` / `actionUnlockedAt`

`ApprovalStep.unlocksAction` adalah flag per-step (dikonfigurasi di alur). Saat ini **hanya** step pertama alur Izin Pulang Cepat (`pulang_cepat`, approver atasan langsung) yang punya flag ini bernilai `true`.

Ketika step dengan `unlocksAction=true` **disetujui**, `LeaveRequest.actionUnlockedAt` distempel waktu saat itu juga — terlepas apakah persetujuan itu step terakhir atau masih lanjut ke step berikutnya. Artinya untuk Izin Pulang Cepat, begitu atasan langsung menyetujui (sebelum Direksi menyetujui sekalipun), field ini sudah terisi.

Field ini **tidak dibaca kembali di manapun** dalam service ini — tampaknya disiapkan sebagai hook untuk fitur turunan (mis. "boleh pulang sekarang karena atasan sudah setuju") yang belum diimplementasikan di file-file yang diperiksa.

---

## 10. Pengalihan Manual oleh HR — `reassignApprover`

- Dibatasi hanya untuk role `hr_admin`.
- Hanya berlaku kalau `status === "pending"`.
- Tidak bisa mengalihkan ke pemohon sendiri.
- Baris approval `pending` saat ini ditandai `status: "reassigned"` (dengan catatan berawalan `"Dialihkan oleh HR Admin: ..."`), lalu dibuat baris `pending` baru di step yang sama untuk approver baru.
- Dua notifikasi terkirim: `approval_reassigned_to_you` (approver baru), `approval_reassigned_away` (approver lama).

---

## 11. Mekanisme Pegawai Pengganti (`pegawai_pengganti`)

- Hanya berlaku untuk jenis `cuti` dan `sakit`; field `substituteEmployeeId` opsional di form.
- `resolveSubstituteInfo` menolak memilih diri sendiri, mewajibkan pengganti berada di departemen yang sama.
- Hasilnya disimpan sebagai **snapshot nama** (`substituteEmployeeName`) di dalam payload JSON — jadi riwayat tetap akurat meski nama/departemen si pengganti berubah di kemudian hari.
- Pengganti benar-benar menjadi approver dalam alur lewat step `pegawai_pengganti` — mereka harus klik Setujui/Tolak/Revisi sebagai konfirmasi kesediaan menggantikan.
- **Jalur menolak**: pengganti memakai aksi "revisi" (opsi paling dekat dengan "menolak jadi pengganti" yang tersedia) → status jadi `"revisi"` → pemohon memilih pengganti **baru** lewat alur ajukan-ulang (§7a), yang otomatis dialihkan ke orang baru tanpa mengirim ulang ke yang sudah menolak.
- Sumber daftar rekan departemen untuk dropdown: `GET /api/leave-requests/department-colleagues`.

---

## 12. Approval Center — Sumber Data (`getPendingApprovalsForUser`)

- Butuh `employeeId` terhubung ke sesi (kalau tidak → `FORBIDDEN`).
- **`hr_admin`/`hr_staff`** (disebut *cross-office viewer*): melihat **semua** pengajuan yang pernah masuk alur approval (`currentStep > 0`) di seluruh sistem, bisa difilter jenis/departemen.
- **Role lain** (termasuk `manager`, `direksi`, bahkan `employee` biasa yang kebetulan jadi approver dinamis lewat step Pegawai Pengganti): hanya melihat pengajuan di mana mereka **pernah** muncul sebagai approver di baris manapun — ini tampilan **riwayat penuh**, bukan cuma yang aktif menunggu mereka.
- **`canAct` per item** = `true` hanya kalau `status === "pending"` DAN baris approval di `currentStep` berstatus `pending` DAN `approverId` adalah user yang login — inilah yang menentukan tombol "Setujui Cepat" muncul atau tidak.
- Data tambahan yang dikembalikan: `stepApproverType` (label step saat ini) dan `submittedDays` (jumlah hari inklusif dari `startDate`–`endDate`).
- **Catatan penting**: Approval Center hanya menyediakan aksi "Setujui Cepat" langsung dari daftar. Aksi Tolak/Revisi mengharuskan membuka halaman detail pengajuan (`/dashboard/employee/leave/[id]`).

---

## 13. Alur Dua Tahap — Izin Lembur (Overtime)

### Tahap 1 — Pengajuan & Approval
Alur normal (`direct_manager → direksi`, lihat §17). Pegawai hanya mengisi `taskDescription` + rentang tanggal (tanpa jam aktual — sengaja ditunda ke Tahap 2). Disetujui lewat mesin status standar (§5), tanpa perlakuan khusus selain anotasi geofencing (§8).

### Tahap 2 — Laporan Realisasi (`submitOvertimeCompletion`)
- Hanya pemilik pengajuan yang boleh mengisi.
- Syarat: `status === "approved"` (harus disetujui penuh dulu — "Lembur harus disetujui penuh sebelum Tahap 2 bisa diisi"), dan `overtimeCompletion` masih kosong (hanya bisa diisi sekali, tidak ada jalur update).
- **Gerbang lampiran**: wajib ada `LeaveRequestAttachment` berkategori `lembur_evidence` sebelum laporan bisa disimpan — dicek lewat query, bukan constraint database.
- Setelah berhasil, tersimpan JSON: `{ actualStartTime, actualEndTime, description, result, submittedAt }`.
- **Lampiran terkunci setelah Tahap 2 disimpan**: baik endpoint upload maupun hapus lampiran menolak perubahan lebih lanjut begitu `overtimeCompletion` terisi ("Tahap 2 sudah disimpan, lampiran tidak bisa diubah lagi"). Untuk jenis izin lain, lampiran cuma bisa dihapus selama status `pending`/`revisi`; khusus lembur, hapus hanya boleh selama status `approved` dan Tahap 2 belum dikunci.
- **Pengingat otomatis** (`checkAndNotifyOverdueOvertimeCompletions`): mencari pengajuan lembur milik user yang sudah `approved`, `overtimeCompletion` masih kosong, dan `endDate` sudah lewat — mengirim notifikasi `overtime_completion_reminder` (idempoten, tidak dobel).

---

## 14. Rute API Terkait

| Rute | Method | Fungsi |
|---|---|---|
| `/api/leave-requests` | GET | Daftar pengajuan milik sendiri (filter jenis/status/tahun/paginasi) |
| `/api/leave-requests` | POST | Buat pengajuan baru (`createLeaveRequest`) |
| `/api/leave-requests/[id]` | GET | Detail satu pengajuan (RBAC: pemilik, role privileged, atau approver step aktif) |
| `/api/leave-requests/[id]/approve` | POST | Setujui |
| `/api/leave-requests/[id]/reject` | POST | Tolak (catatan wajib diisi) |
| `/api/leave-requests/[id]/revise` | POST | Minta revisi (catatan wajib diisi) |
| `/api/leave-requests/[id]/resubmit` | POST | Ajukan ulang (edit detail atau ganti pengganti) |
| `/api/leave-requests/[id]/reassign` | POST | Alihkan approver — khusus `hr_admin` |
| `/api/leave-requests/[id]/overtime-completion` | POST | Simpan Laporan Realisasi Lembur (Tahap 2) |
| `/api/leave-requests/[id]/attachments` | POST | Unggah lampiran (JPG/PNG/PDF, maks 5MB) |
| `/api/leave-requests/[id]/attachments/[attachmentId]` | DELETE | Hapus lampiran (bergerbang status) |
| `/api/leave-requests/my-balance` | GET | Saldo cuti tahunan tahun berjalan |
| `/api/leave-requests/my-entitlement` | GET | Ringkasan kuota Cuti Besar/Khusus Haji/Khusus Umroh |
| `/api/leave-requests/department-colleagues` | GET | Daftar rekan departemen untuk dropdown pengganti |

Pola konsisten di semua rute: cek sesi → panggil fungsi service → error `LeaveRequestError` dipetakan ke HTTP status (`FORBIDDEN`→403, `NOT_FOUND`→404, `VALIDATION`→400, `INSUFFICIENT_BALANCE`→409, lainnya→500).

---

## 15. Routing Notifikasi

`getNotificationHref(notification, role)`:
- Kalau tipe notifikasi `leave_request_submitted` DAN role punya halaman Approval Center sendiri → arahkan ke sana:
  - `hr_admin`, `hr_staff`, `direksi` → `/dashboard/admin/approvals`
  - `manager` → `/dashboard/manager/approvals`
- Selain itu (semua tipe notifikasi lain, atau role tanpa Approval Center — mis. `employee` biasa yang jadi approver dinamis lewat Pegawai Pengganti, atau notifikasi ke pemohon seperti disetujui/ditolak/revisi) → langsung ke halaman detail pengajuan `/dashboard/employee/leave/[id]`.

---

## 16. Tampilan Approval Center

**`ApprovalCenterPage.tsx`** — server component: cek sesi → `getPendingApprovalsForUser` → redirect ke halaman utama role kalau `FORBIDDEN` → render `ApprovalCenterList`.

**`ApprovalCenterList.tsx`** — tabel client-side (react-table):
- Label step approver: Atasan Langsung, Kepala Departemen, Pegawai Pengganti (Konfirmasi), HR, Direksi, Ditunjuk.
- Badge status: Menunggu (kuning), Disetujui (hijau), Ditolak (merah), Perlu Revisi (kuning), Dibatalkan (abu-abu, belum pernah dipakai backend), Selesai (biru, belum pernah dipakai backend).
- Kolom: Pemohon, Jenis Izin, Tanggal, Hari, Status, Step, Diajukan, Aksi.
- Aksi inline hanya **Setujui Cepat** (muncul kalau `canAct`), dengan optimistic update lalu `router.refresh()`. Tombol "Detail" selalu ada, mengarah ke halaman detail (tempat Tolak/Revisi dilakukan).
- Filter jenis izin di dropdown saat ini **belum mencakup 5 jenis izin baru** (Cuti Bersalin/Besar/Luar Tanggungan/Khusus, Dispensasi) — kemungkinan celah UI yang perlu ditambahkan.

---

## 17. Alur Approval yang Benar-Benar Terkonfigurasi (dari `prisma/seed.ts`)

| Jenis Izin | Rantai Approval |
|---|---|
| Izin Lembur (`lembur`) | Atasan Langsung → Direksi |
| Izin Meninggalkan Kantor (`meninggalkan_kantor`) | Atasan Langsung → Direksi |
| Izin Cuti (`cuti`) | Atasan Langsung → HR → Direksi *(HR di-skip otomatis kalau ≤3 hari)* |
| Izin Sakit (`sakit`) | Atasan Langsung → Direksi |
| Izin Pulang Cepat (`pulang_cepat`) | Atasan Langsung **(unlocksAction)** → Direksi |
| Izin Terlambat (`terlambat`) | Atasan Langsung → Direksi |

Dan alur default (dibuat otomatis saat pertama kali dipakai, lewat `DEFAULT_FLOW_STEPS`) untuk 5 jenis izin yang lebih baru:

| Jenis Izin | Rantai Approval |
|---|---|
| Cuti Bersalin/Gugur Kandungan (`cuti_bersalin`) | Kepala Departemen → Direksi |
| Cuti Besar (`cuti_besar`) | HR → Kepala Departemen → Direksi |
| Cuti Di Luar Tanggungan (`cuti_luar_tanggungan`) | HR → Kepala Departemen → Direksi |
| Cuti Khusus Haji/Umroh (`cuti_khusus`) | Kepala Departemen → Direksi |
| Dispensasi (`dispensasi`) | Kepala Departemen (satu step saja) |

Tidak ada satupun dari 5 alur default ini yang memakai `unlocksAction`, `pegawai_pengganti`, atau `specific_user`.

Kedua sumber (seed eksplisit vs default lazy) disimpan dengan cara yang identik di database (baris `ApprovalFlow`/`ApprovalStep` biasa) — bedanya cuma **kapan** dibuat, bukan cara kerjanya. Semua alur tetap bisa diedit lewat halaman admin "Alur Approval" setelah terbentuk.

---

## 18. Semua Jenis Izin yang Didukung

| Kunci internal | Label Indonesia |
|---|---|
| `lembur` | Izin Lembur |
| `meninggalkan_kantor` | Izin Meninggalkan Kantor |
| `cuti` | Izin Cuti |
| `sakit` | Izin Sakit |
| `pulang_cepat` | Izin Pulang Cepat |
| `terlambat` | Izin Terlambat |
| `cuti_bersalin` | Cuti Bersalin / Gugur Kandungan |
| `cuti_besar` | Cuti Besar |
| `cuti_luar_tanggungan` | Cuti Di Luar Tanggungan Perusahaan |
| `cuti_khusus` | Cuti Khusus (Haji/Umroh) |
| `dispensasi` | Dispensasi |

Jenis `cuti` masih menyimpan field lama `leaveKind` (`tahunan | menikah | melahirkan | duka | lainnya`) untuk kompatibilitas data lama — tapi hanya `tahunan` yang aktif dicek saldo/dikurangi; jenis lainnya sudah digantikan oleh 5 jenis izin baru yang berdiri sendiri.

---

## 19. Catatan Penting untuk Pembaca Dokumen Ini

- `ApprovalFlow.departmentId` dan `ApprovalStep.condition` **ada di skema database tapi tidak dipakai di kode manapun saat ini** — kemungkinan disiapkan untuk fitur mendatang (alur berbeda per departemen / kondisi bersyarat per step).
- Status `cancelled` dan `finished` pada `LeaveRequest` **hanya muncul di peta label UI**, tidak pernah diset oleh kode backend manapun yang diperiksa — perlu dikonfirmasi apakah ini rencana fitur mendatang atau sisa kode lama.
- **Geofencing tidak pernah memblokir apapun** — baik di Izin Terlambat maupun Izin Lembur, jarak dari kantor cuma informasi tambahan untuk approver, bukan syarat lolos/tidaknya pengajuan.
- Aksi Tolak/Revisi tidak tersedia langsung dari Approval Center — approver harus membuka halaman detail pengajuan untuk itu.
