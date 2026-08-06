// Konstanta rentang tanggal default Ruang Tim — file terpisah dari
// lib/team-feed.ts (yang import Prisma) supaya bisa dipakai langsung oleh
// client component (TeamFeedContent) tanpa ikut nge-bundle Prisma ke client.
export const FEED_DEFAULT_WINDOW_DAYS = 30

export function defaultFeedSinceDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() - FEED_DEFAULT_WINDOW_DAYS)
  return d
}
