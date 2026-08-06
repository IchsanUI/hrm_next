export function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Baru saja"
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay} hari lalu`
}

// Dipakai Ruang Tim — waktu relatif ("X jam lalu") cuma informatif buat 2
// hari pertama, lewat dari itu tanggal pastinya lebih berguna daripada
// "3 hari lalu" yang makin lama makin kabur.
export function formatFeedTime(date: Date) {
  const diffDays = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)
  if (diffDays < 2) return formatRelativeTime(date)
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}
