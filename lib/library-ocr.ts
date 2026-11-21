import { spawn } from "child_process"
import { existsSync } from "fs"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"

// Mesin OCR Perpustakaan (docs/prd-ocr-perpustakaan.md, Tahap 2).
// - Render satu halaman PDF → PNG 300 dpi abu-abu dengan `pdftoppm` (poppler-utils).
// - OCR dengan `tesseract` bahasa Indonesia + Inggris, keluaran TSV (teks + keyakinan per kata).
// Server dipakai bersama layanan lain (VA, topup), jadi setiap proses:
// - dikunci SATU thread (OMP_THREAD_LIMIT=1) — Tesseract bawaannya memakai semua inti;
// - berprioritas terendah (`nice -n 19`) bila tersedia;
// - dibatasi waktu per halaman (Pengaturan Perpustakaan) lalu dihentikan paksa.

const EXE = process.platform === "win32" ? ".exe" : ""

function findInPath(binary: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, binary + EXE)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function isOcrEngineAvailable(): boolean {
  return findInPath("tesseract") !== null && findInPath("pdftoppm") !== null
}

export class OcrTimeoutError extends Error {
  constructor(seconds: number) {
    super(`OCR melewati batas waktu ${seconds} detik.`)
    this.name = "OcrTimeoutError"
  }
}

function run(command: string, args: string[], timeoutSec: number): Promise<string> {
  const useNice = process.platform !== "win32" && findInPath("nice") !== null
  const [cmd, cmdArgs] = useNice ? ["nice", ["-n", "19", command, ...args]] : [command, args]
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      env: { ...process.env, OMP_THREAD_LIMIT: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutSec * 1000)
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk))
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (timedOut) return reject(new OcrTimeoutError(timeoutSec))
      if (code !== 0) {
        const message = Buffer.concat(err).toString("utf8").trim().split("\n").slice(-2).join(" ")
        return reject(new Error(`${command} gagal (kode ${code})${message ? `: ${message}` : ""}`))
      }
      resolve(Buffer.concat(out).toString("utf8"))
    })
  })
}

// Bahasa yang terpasang — `ind` dipakai bila ada, `eng` selalu ikut.
let cachedLangs: string | null = null
async function ocrLanguages(): Promise<string> {
  if (cachedLangs) return cachedLangs
  try {
    const list = await run("tesseract", ["--list-langs"], 20)
    const langs = new Set(list.split(/\r?\n/).map((l) => l.trim()))
    cachedLangs = langs.has("ind") ? (langs.has("eng") ? "ind+eng" : "ind") : "eng"
  } catch {
    cachedLangs = "eng"
  }
  return cachedLangs
}

export type OcrPageResult = { text: string; confidence: number | null }

// TSV Tesseract: level 5 = kata. Kata disusun ulang per baris (block/par/line),
// keyakinan = rata-rata conf kata yang valid (0–100).
export function parseTesseractTsv(tsv: string): OcrPageResult {
  const rows = tsv.split(/\r?\n/)
  const header = rows.shift()?.split("\t") ?? []
  const col = (name: string) => header.indexOf(name)
  const [iLevel, iBlock, iPar, iLine, iConf, iText] = ["level", "block_num", "par_num", "line_num", "conf", "text"].map(col)
  if ([iLevel, iBlock, iPar, iLine, iConf, iText].some((i) => i < 0)) return { text: "", confidence: null }

  const lines = new Map<string, string[]>()
  let confSum = 0
  let confCount = 0
  for (const row of rows) {
    const cells = row.split("\t")
    if (cells[iLevel] !== "5") continue
    const word = (cells[iText] ?? "").trim()
    if (!word) continue
    const key = `${cells[iBlock]}-${cells[iPar]}-${cells[iLine]}`
    const words = lines.get(key) ?? []
    words.push(word)
    lines.set(key, words)
    const conf = Number(cells[iConf])
    if (Number.isFinite(conf) && conf >= 0) {
      confSum += conf
      confCount++
    }
  }
  return {
    text: [...lines.values()].map((w) => w.join(" ")).join("\n"),
    confidence: confCount ? Math.round((confSum / confCount) * 10) / 10 : null,
  }
}

export async function ocrPdfPage(filePath: string, page: number, timeoutSec: number): Promise<OcrPageResult> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hris-ocr-"))
  try {
    const prefix = path.join(dir, "page")
    await run(
      "pdftoppm",
      ["-f", String(page), "-l", String(page), "-r", "300", "-gray", "-png", "-singlefile", filePath, prefix],
      timeoutSec
    )
    const tsv = await run("tesseract", [`${prefix}.png`, "stdout", "-l", await ocrLanguages(), "tsv"], timeoutSec)
    return parseTesseractTsv(tsv)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
