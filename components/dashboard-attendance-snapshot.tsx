import type { TodayAttendanceRow } from "@/lib/dashboard-stats"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatTime(date: Date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
}

// Cuplikan ringkas — bukan tabel penuh dengan search/pagination, cuma
// beberapa baris terbaru buat ngintip cepat dari dashboard.
export function DashboardAttendanceSnapshot({ rows }: { rows: TodayAttendanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada absensi tercatat hari ini.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Lokasi</TableHead>
          <TableHead className="text-right">Jam</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="truncate">{row.name}</TableCell>
            <TableCell className="text-muted-foreground">{row.location}</TableCell>
            <TableCell className="text-right tabular-nums">{formatTime(row.logTime)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
