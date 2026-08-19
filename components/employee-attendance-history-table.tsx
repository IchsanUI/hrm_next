"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type {
  EmployeeAttendanceDayRow,
  EmployeeAttendanceStatus,
} from "@/lib/employee-dashboard-stats";

const STATUS_LABEL: Record<EmployeeAttendanceStatus, string> = {
  TERLAMBAT: "Terlambat",
  PULANG_CEPAT: "Pulang Cepat",
  TEPAT_WAKTU: "Tepat waktu",
  TIDAK_ADA_JAM_KERJA: "Jam kerja belum diatur",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    // Eksplisit — komponen client, render di browser pengguna, timezone
    // OS server (ENV TZ) tidak berpengaruh di sini sama sekali.
    timeZone: "Asia/Jakarta",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// Tap dobel (mis. pegawai tap 2x cuma buat mastiin) tetap ditampilkan
// sebagai riwayat, tapi diredupkan supaya jelas mana jam yang dipakai
// buat status Terlambat/Pulang Cepat (jam pertama) dan mana yang cuma tap
// tambahan (bukan diam-diam disembunyikan).
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
function StatusBadges({ statuses }: { statuses: EmployeeAttendanceStatus[] }) {
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

export function EmployeeAttendanceHistoryTable({
  rows,
  dateFilter,
}: {
  rows: EmployeeAttendanceDayRow[];
  dateFilter?: ReactNode;
}) {
  const columns: ColumnDef<EmployeeAttendanceDayRow, unknown>[] = [
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
    <div className="grid gap-3">
      <p className="text-sm">
        Total hadir pada rentang tanggal ini:{" "}
        <span className="font-semibold">{rows.length} hari</span>
      </p>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari tanggal atau status..."
        emptyMessage="Belum ada data absensi pada rentang tanggal ini."
        pageSize={20}
        toolbarEnd={dateFilter}
      />
    </div>
  );
}
