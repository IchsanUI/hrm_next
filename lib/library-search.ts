import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { LibrarySearchHit, LibrarySearchMatch, LibrarySnippetSegment } from "@/lib/library-text-labels"

// Pencarian isi dokumen Perpustakaan memakai indeks FULLTEXT MariaDB pada
// library_document_pages.text (mode boolean). Kata < 3 huruf diabaikan oleh
// indeks (innodb_ft_min_token_size), jadi kueri yang hanya berisi kata
// pendek memakai LIKE sebagai cadangan.

const MIN_TOKEN = 3
const MAX_ROWS = 400
const SNIPPETS_PER_DOC = 3

export type ParsedQuery = {
  boolean: string | null // kueri MATCH ... AGAINST (null = pakai LIKE)
  terms: string[] // kata/frasa untuk ditebalkan di cuplikan (huruf kecil)
  likeText: string
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const query = raw.trim().slice(0, 200)
  const parts: string[] = []
  const terms: string[] = []

  const withoutPhrases = query.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const words = phrase.match(/[\p{L}\p{N}]+/gu) ?? []
    if (words.length) {
      parts.push(`+"${words.join(" ")}"`)
      terms.push(words.join(" ").toLowerCase())
    }
    return " "
  })
  for (const word of withoutPhrases.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const lower = word.toLowerCase()
    if (lower.length >= 2) terms.push(lower)
    if (lower.length >= MIN_TOKEN) parts.push(`+${lower}*`)
  }

  return {
    boolean: parts.length ? parts.join(" ") : null,
    terms: [...new Set(terms)].sort((a, b) => b.length - a.length),
    likeText: query.replace(/"/g, "").trim(),
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Potongan ±180 karakter di sekitar kecocokan pertama, dengan setiap kata
// yang dicari ditandai `hit`.
export function buildSnippet(text: string, terms: string[], width = 180): LibrarySnippetSegment[] {
  if (!text) return []
  const usable = terms.filter(Boolean)
  // Kata pendek (< 3 huruf, mis. "TI") hanya cocok sebagai kata utuh,
  // supaya tidak menyorot bagian dari kata lain ("aktivitas").
  const pattern = usable.length
    ? new RegExp(
        usable
          .map((t) => (t.length < MIN_TOKEN ? `(?<![\\p{L}\\p{N}])${escapeRegExp(t)}(?![\\p{L}\\p{N}])` : escapeRegExp(t)))
          .join("|"),
        "giu"
      )
    : null
  const first = pattern ? text.search(pattern) : -1
  const anchor = first < 0 ? 0 : first
  let start = Math.max(0, anchor - Math.floor(width / 3))
  let end = Math.min(text.length, start + width)
  if (start > 0) {
    const space = text.indexOf(" ", start)
    if (space > -1 && space < anchor) start = space + 1
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end)
    if (space > anchor) end = space
  }
  const window = text.slice(start, end)
  const segments: LibrarySnippetSegment[] = []
  if (start > 0) segments.push({ text: "… ", hit: false })
  if (pattern) {
    let last = 0
    for (const m of window.matchAll(pattern)) {
      const idx = m.index ?? 0
      if (idx > last) segments.push({ text: window.slice(last, idx), hit: false })
      segments.push({ text: m[0], hit: true })
      last = idx + m[0].length
    }
    if (last < window.length) segments.push({ text: window.slice(last), hit: false })
  } else {
    segments.push({ text: window, hit: false })
  }
  if (end < text.length) segments.push({ text: " …", hit: false })
  return segments
}

type Row = {
  documentId: number
  pageNumber: number
  text: string
  score: number
  publicId: string
  partOfId: number | null
  partNumber: number | null
  rootPublicId: string
}

/**
 * Cari isi dokumen. `documentIds` membatasi ke dokumen tertentu (mis. halaman
 * baca). Hasil dikelompokkan per dokumen utama (Bagian 1 + bagian lainnya).
 */
export async function searchLibraryContent(
  raw: string,
  options: { includeDrafts?: boolean; documentIds?: number[] } = {}
): Promise<{ hits: LibrarySearchHit[]; terms: string[]; pagesByDocument: Map<number, number[]> }> {
  const parsed = parseSearchQuery(raw)
  const empty = { hits: [], terms: parsed.terms, pagesByDocument: new Map<number, number[]>() }
  if (!parsed.boolean && parsed.likeText.length < 2) return empty

  const published = options.includeDrafts ? Prisma.empty : Prisma.sql`AND d.isPublished = 1`
  const onlyDocs = options.documentIds?.length ? Prisma.sql`AND p.documentId IN (${Prisma.join(options.documentIds)})` : Prisma.empty
  // Cadangan untuk kueri kata pendek: cocokkan sebagai kata utuh (REGEXP
  // PCRE MariaDB; tidak peka huruf besar/kecil karena collation _ci).
  const wordRegex = `(^|[^[:alnum:]])${escapeRegExp(parsed.likeText)}([^[:alnum:]]|$)`

  const rows = parsed.boolean
    ? await prisma.$queryRaw<Row[]>`
        SELECT p.documentId, p.pageNumber, p.text, MATCH(p.text) AGAINST (${parsed.boolean} IN BOOLEAN MODE) AS score,
               d.publicId, d.partOfId, d.partNumber, COALESCE(parent.publicId, d.publicId) AS rootPublicId
        FROM library_document_pages p
        JOIN library_documents d ON d.id = p.documentId
        LEFT JOIN library_documents parent ON parent.id = d.partOfId
        WHERE MATCH(p.text) AGAINST (${parsed.boolean} IN BOOLEAN MODE) ${published} ${onlyDocs}
        ORDER BY score DESC
        LIMIT ${MAX_ROWS}`
    : await prisma.$queryRaw<Row[]>`
        SELECT p.documentId, p.pageNumber, p.text, 1 AS score,
               d.publicId, d.partOfId, d.partNumber, COALESCE(parent.publicId, d.publicId) AS rootPublicId
        FROM library_document_pages p
        JOIN library_documents d ON d.id = p.documentId
        LEFT JOIN library_documents parent ON parent.id = d.partOfId
        WHERE p.text REGEXP ${wordRegex} ${published} ${onlyDocs}
        LIMIT ${MAX_ROWS}`

  const pagesByDocument = new Map<number, number[]>()
  const groups = new Map<string, { best: number; rows: Row[] }>()
  for (const row of rows) {
    const pages = pagesByDocument.get(row.documentId) ?? []
    pages.push(Number(row.pageNumber))
    pagesByDocument.set(row.documentId, pages)
    const group = groups.get(row.rootPublicId) ?? { best: 0, rows: [] }
    group.best = Math.max(group.best, Number(row.score))
    group.rows.push(row)
    groups.set(row.rootPublicId, group)
  }
  for (const pages of pagesByDocument.values()) pages.sort((a, b) => a - b)

  const hits: LibrarySearchHit[] = [...groups.entries()]
    .sort((a, b) => b[1].best - a[1].best)
    .map(([rootPublicId, group]) => {
      const matches: LibrarySearchMatch[] = group.rows
        .slice(0, SNIPPETS_PER_DOC)
        .sort((a, b) => (a.partNumber ?? 1) - (b.partNumber ?? 1) || a.pageNumber - b.pageNumber)
        .map((row) => ({
          publicId: row.publicId,
          partNumber: row.partOfId ? row.partNumber : null,
          page: Number(row.pageNumber),
          segments: buildSnippet(row.text, parsed.terms),
        }))
      return { publicId: rootPublicId, totalMatches: group.rows.length, matches }
    })

  return { hits, terms: parsed.terms, pagesByDocument }
}
