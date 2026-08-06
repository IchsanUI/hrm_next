import { Fragment } from "react"

// Highlight kosmetik "@Nama Lengkap" di teks post/komentar Ruang Tim.
// SENGAJA cocokkan persis nama-nama rekan departemen yang dikirim server
// (bukan regex tebak-tebakan) — supaya tidak salah nangkep teks biasa yang
// kebetulan diawali huruf kapital setelah "@". Tidak ada implikasi keamanan,
// murni tampilan (fan-out notifikasi mention sudah divalidasi terpisah di
// server saat komentar/post dibuat).
export function MentionText({ text, names }: { text: string; names: string[] }) {
  if (names.length === 0 || !text.includes("@")) return <>{text}</>

  // Nama lebih panjang dicoba dicocokkan lebih dulu, supaya "Budi Santoso"
  // tidak keburu ke-cut jadi cuma "Budi" oleh nama lain yang jadi prefix-nya.
  const sortedNames = [...names].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(
    `@(${sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  )

  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) => {
        const isMention = i % 2 === 1
        return isMention ? (
          <span key={i} className="font-medium text-blue-600 dark:text-blue-400">
            @{part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </>
  )
}
