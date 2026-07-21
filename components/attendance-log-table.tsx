"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

export type AttendanceLogRow = {
  id: number;
  userPin: string;
  name: string;
  location: string;
  logTime: Date;
  verifyType: string;
  logType: string;
  note: string | null;
  employeeName: string | null;
};

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceLogTable({
  rows,
  dateFilter,
}: {
  rows: AttendanceLogRow[];
  dateFilter?: ReactNode;
}) {
  const columns: ColumnDef<AttendanceLogRow, unknown>[] = [
    { accessorKey: "userPin", header: "PIN" },
    {
      id: "name",
      header: "Nama",
      accessorFn: (row) => row.employeeName ?? row.name,
      cell: ({ row }) =>
        row.original.employeeName ?? (row.original.name || "-"),
    },
    {
      id: "status",
      header: "Status",
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
      accessorFn: (row) => formatDate(row.logTime),
    },
    {
      id: "time",
      header: "Jam",
      accessorFn: (row) => formatTime(row.logTime),
    },
    { accessorKey: "location", header: "Lokasi" },
    { accessorKey: "verifyType", header: "Verifikasi" },
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
