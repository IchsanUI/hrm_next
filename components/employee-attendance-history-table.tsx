"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { EmployeeAttendanceHistoryRow } from "@/lib/employee-dashboard-stats";

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
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

export function EmployeeAttendanceHistoryTable({
  rows,
  dateFilter,
}: {
  rows: EmployeeAttendanceHistoryRow[];
  dateFilter?: ReactNode;
}) {
  const columns: ColumnDef<EmployeeAttendanceHistoryRow, unknown>[] = [
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
    { accessorKey: "logType", header: "Jenis" },
    { accessorKey: "location", header: "Lokasi" },
    { accessorKey: "verifyType", header: "Verifikasi" },
    {
      id: "note",
      header: "Status",
      accessorFn: (row) => row.note ?? "-",
      cell: ({ row }) =>
        row.original.note ? (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
          >
            {row.original.note}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Tepat waktu
          </Badge>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Cari lokasi atau verifikasi..."
      emptyMessage="Belum ada data absensi pada rentang tanggal ini."
      pageSize={20}
      toolbarEnd={dateFilter}
    />
  );
}
