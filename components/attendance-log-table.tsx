"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { AttendanceStatus } from "@/lib/attendance/day-summary";

export type AttendanceDayRow = {
  userPin: string;
  name: string;
  employeeName: string | null;
  date: Date;
  checkIn: Date;
  checkInLocation: string;
  checkInExtraTaps: Date[];
  checkOut: Date | null;
  checkOutLocation: string | null;
  checkOutExtraTaps: Date[];
  statuses: AttendanceStatus[];
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  TERLAMBAT: "Terlambat",
  PULANG_CEPAT: "Pulang Cepat",
  TEPAT_WAKTU: "Tepat waktu",
  TIDAK_ADA_JAM_KERJA: "Jam kerja belum diatur",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    // Eksplisit — ini komponen client, jadi render di browser pengguna
    // (bukan server), timezone OS server (ENV TZ) tidak berpengaruh sama
    // sekali di sini. Tanpa ini, tanggal ikut timezone perangkat pengguna,
    // bisa geser sehari dari WIB kalau device-nya di-set timezone lain.
    timeZone: "Asia/Jakarta",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    // Lihat catatan timeZone di formatDate() di atas.
    timeZone: "Asia/Jakarta",
  });
}

// Tap dobel (mis. pegawai tap 2x cuma buat mastiin) tetap ditampilkan
// sebagai riwayat, tapi diredupkan supaya jelas mana jam yang dipakai
// buat status Terlambat/Pulang Cepat (jam pertama/terakhir) dan mana yang
// cuma tap tambahan.
function TimeCell({ primary, extras }: { primary: Date; extras: Date[] }) {
  return (
    <span>
      {formatTime(primary)}
      {extras.length > 0 ? (
        <span className="text-muted-foreground text-xs">
          {" "}
          : {extras.map((t) => formatTime(t)).join(", ")}
        </span>
      ) : null}
    </span>
  );
}

// Terlambat & Pulang Cepat bisa kejadian bareng di hari yang sama — jadi
// bisa nongol lebih dari satu badge per baris, bukan cuma satu status.
function StatusBadges({ statuses }: { statuses: AttendanceStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((status) =>
        status === "TERLAMBAT" || status === "PULANG_CEPAT" ? (
          <Badge
            key={status}
            variant="outline"
            className="border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
          >
            {STATUS_LABEL[status]}
          </Badge>
        ) : (
          <Badge key={status} variant="outline" className="text-xs text-muted-foreground">
            {STATUS_LABEL[status]}
          </Badge>
        )
      )}
    </div>
  );
}

export function AttendanceLogTable({
  rows,
  dateFilter,
}: {
  rows: AttendanceDayRow[];
  dateFilter?: ReactNode;
}) {
  const columns: ColumnDef<AttendanceDayRow, unknown>[] = [
    { accessorKey: "userPin", header: "PIN" },
    {
      id: "name",
      header: "Nama",
      accessorFn: (row) => row.employeeName ?? row.name,
      cell: ({ row }) =>
        row.original.employeeName ?? (row.original.name || "-"),
    },
    {
      id: "connection",
      header: "Koneksi",
      accessorFn: (row) => (row.employeeName ? "Terhubung" : "-"),
      cell: ({ row }) =>
        row.original.employeeName ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            Terhubung
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            -
          </Badge>
        ),
    },
    {
      id: "date",
      header: "Tanggal",
      accessorFn: (row) => formatDate(row.date),
    },
    {
      id: "checkIn",
      header: "Jam Masuk",
      accessorFn: (row) => formatTime(row.checkIn),
      cell: ({ row }) => (
        <TimeCell primary={row.original.checkIn} extras={row.original.checkInExtraTaps} />
      ),
    },
    {
      id: "checkInLocation",
      header: "Lokasi Absen Masuk",
      accessorFn: (row) => row.checkInLocation,
    },
    {
      id: "checkOut",
      header: "Jam Pulang",
      accessorFn: (row) => (row.checkOut ? formatTime(row.checkOut) : "-"),
      cell: ({ row }) =>
        row.original.checkOut ? (
          <TimeCell primary={row.original.checkOut} extras={row.original.checkOutExtraTaps} />
        ) : (
          "-"
        ),
    },
    {
      id: "checkOutLocation",
      header: "Lokasi Absen Pulang",
      accessorFn: (row) => row.checkOutLocation ?? "-",
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.statuses.map((s) => STATUS_LABEL[s]).join(", "),
      cell: ({ row }) => <StatusBadges statuses={row.original.statuses} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari nama atau PIN..."
      emptyMessage="Belum ada data absensi pada rentang tanggal ini."
      pageSize={20}
      toolbarEnd={dateFilter}
    />
  );
}
