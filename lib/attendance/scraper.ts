// Port dari scrapperattendancephy/attendsync_service.py (Python) — login +
// scrape attlog dari mesin fingerprint ZK Premier Series lewat web
// interface bawaannya, lalu parse jadi record siap simpan.
//
// Device-nya HTML lama & sederhana (bukan SPA), jadi di-parse pakai regex
// atribut sendiri (bukan library HTML parser) — cukup buat pola tag yang
// konsisten dari firmware ini, dan menghindari dependency baru.

const INOUT_MAP: Record<string, string> = {
  "0": "Check-In",
  "1": "Check-Out",
  "4": "OT-In",
  "5": "OT-Out",
}
const VERIFY_MAP: Record<string, string> = { "0": "PIN", "1": "Fingerprint", "3": "Card" }

export type AttendanceRecord = {
  userPin: string
  name: string
  logTime: Date
  verifyType: string
  logType: string
}

// ══════════════════════════════════════════════════════
//  SESSION / COOKIE JAR — satu per device, TIDAK boleh dipakai bersama
//  antar-device (mesin nyimpen SessionID cookie per koneksi).
// ══════════════════════════════════════════════════════
class DeviceSession {
  private cookies = new Map<string, string>()

  private captureCookies(res: Response) {
    const setCookies =
      typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
    for (const raw of setCookies) {
      const pair = raw.split(";", 1)[0]
      const eq = pair.indexOf("=")
      if (eq === -1) continue
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")
  }

  async get(url: string): Promise<Response> {
    const res = await fetch(url, {
      method: "GET",
      headers: this.cookieHeader() ? { Cookie: this.cookieHeader() } : {},
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    this.captureCookies(res)
    return res
  }

  async post(url: string, body: URLSearchParams): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    }
    if (this.cookieHeader()) headers.Cookie = this.cookieHeader()
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    })
    this.captureCookies(res)
    return res
  }
}

function safeText(res: Response): Promise<string> {
  return res.text().catch(() => "")
}

export type LoginResult = { ok: boolean; reason?: string }

export async function login(
  baseUrl: string,
  loginUser: string,
  loginPass: string,
  session: DeviceSession
): Promise<LoginResult> {
  try {
    await session.get(`${baseUrl}/`)
    await session.get(`${baseUrl}/csl/login`)
    const body = new URLSearchParams({ username: loginUser, userpwd: loginPass })
    const res = await session.post(`${baseUrl}/csl/check`, body)
    const text = await safeText(res)
    if (text.toUpperCase().includes("<FRAMESET") && !res.url.includes("/csl/login")) {
      return { ok: true }
    }
    // Fallback: cek apakah bisa akses halaman download
    const chk = await session.get(`${baseUrl}/csl/download`)
    const chkText = await safeText(chk)
    if (chk.status === 200 && chkText.includes("Download") && !chk.url.includes("login")) {
      return { ok: true }
    }
    return {
      ok: false,
      reason: `Login ditolak mesin (status POST ${res.status}, status fallback ${chk.status}) — cek username/password login di mesin.`,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: `Tidak bisa konek ke ${baseUrl}: ${message}` }
  }
}

// ══════════════════════════════════════════════════════
//  PARSING HTML (regex, sesuai firmware device — lihat catatan di atas)
// ══════════════════════════════════════════════════════
// Dukung atribut dikutip ganda, kutip satu, maupun tanpa kutip sama sekali
// (BeautifulSoup di versi Python-nya agnostik terhadap gaya kutip ini,
// regex sendiri harus eksplisit menangani ketiganya).
function parseTagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ""
  }
  return attrs
}

function findInputTags(html: string): string[] {
  return html.match(/<input\b[^>]*>/gi) ?? []
}

// Cari path "/csl/download?first=X&last=Y" LANGSUNG di teks tag mentah
// (bukan lewat nilai atribut onclick yang sudah "dibersihkan" oleh
// parseTagAttrs). Device ini kadang menulis onclick='dataquery('/csl/...')'
// — kutip satu bersarang, sama persis di luar dan di dalam — yang bikin
// parser atribut mana pun (regex kita, bahkan BeautifulSoup) salah potong
// nilainya di kutip pertama yang ketemu. Solusinya: jangan coba
// menyeimbangkan pasangan kutip sama sekali, cukup cari substring URL-nya
// langsung (huruf/angka/&/=) sampai berhenti di karakter kutip/spasi/tag
// pertama — hasilnya sama tanpa peduli struktur kutipnya valid atau tidak.
function extractDataqueryPath(tagOrOnclick: string): string | null {
  const m = tagOrOnclick.match(/\/csl\/download\?[\w&=]+/)
  return m ? m[0] : null
}

function parseQueryInts(qs: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const kv of qs.split("&")) {
    const [k, v] = kv.split("=")
    if (k && v !== undefined && /^\d+$/.test(v)) out[k] = Number(v)
  }
  return out
}

export type UserIdsResult = { ids: string[]; reason?: string; trace: string[] }

async function getAllUserIds(baseUrl: string, session: DeviceSession): Promise<UserIdsResult> {
  const allIds = new Set<string>()
  const maxPages = 50
  // Jejak keputusan tiap langkah — dipakai buat diagnosis kalau pagination
  // berhenti lebih awal dari seharusnya, karena kita tidak bisa cek HTML
  // mentah mesin secara langsung.
  const trace: string[] = []

  try {
    let res = await session.get(`${baseUrl}/csl/download`)
    if (res.status !== 200) {
      return {
        ids: [],
        reason: `Halaman /csl/download mengembalikan status ${res.status}.`,
        trace,
      }
    }
    let html = await safeText(res)

    const collectCheckboxIds = (doc: string) => {
      for (const tag of findInputTags(doc)) {
        const attrs = parseTagAttrs(tag)
        if (attrs.type?.toLowerCase() === "checkbox" && /^\d+$/.test(attrs.value ?? "")) {
          allIds.add(attrs.value)
        }
      }
    }
    // Mengembalikan TAG MENTAHNYA (bukan attrs.onclick hasil parsing) —
    // lihat catatan di extractDataqueryPath soal kenapa nilai onclick tidak
    // bisa diandalkan dari parser atribut biasa untuk device ini.
    const findButton = (doc: string, label: string): string | null => {
      for (const tag of findInputTags(doc)) {
        const attrs = parseTagAttrs(tag)
        if (attrs.type?.toLowerCase() === "button" && attrs.value === label) {
          return tag
        }
      }
      return null
    }

    collectCheckboxIds(html)
    trace.push(`Halaman 1: ${allIds.size} checkbox UID ditemukan.`)

    if (allIds.size === 0) {
      return {
        ids: [],
        trace,
        reason:
          "Tidak ditemukan checkbox user (uid) di halaman /csl/download — kemungkinan tidak ada data pegawai tersimpan di mesin, atau struktur HTML halaman berbeda dari yang diharapkan.",
      }
    }

    // "Last Page" dipakai kalau berhasil di-parse (jalur cepat, tahu garis
    // finish dari awal) — tapi TIDAK WAJIB. Kalau gagal diekstrak, kita
    // tetap lanjut pakai "Next Page" saja dan berhenti begitu satu halaman
    // tidak lagi menambah UID baru (lihat blok loop di bawah).
    let lastFirst: number | null = null
    let lastLast: number | null = null
    const lastButtonTag = findButton(html, "Last Page")
    if (!lastButtonTag) {
      trace.push('Tombol "Last Page" TIDAK ditemukan di halaman 1.')
    } else {
      const lastPath = extractDataqueryPath(lastButtonTag)
      if (!lastPath) {
        trace.push('Tombol "Last Page" ada tapi path tidak bisa diekstrak dari tag-nya.')
      } else {
        const lastParams = parseQueryInts(lastPath.split("?", 2)[1] ?? "")
        lastFirst = lastParams.first ?? 0
        lastLast = lastParams.last ?? 0
        trace.push(`Path "Last Page": ${lastPath} → first=${lastFirst}, last=${lastLast}.`)
      }
    }

    const nextButtonTag = findButton(html, "Next Page")
    if (!nextButtonTag) {
      trace.push('Tombol "Next Page" TIDAK ditemukan di halaman 1 — berhenti di halaman 1.')
      return { ids: Array.from(allIds).sort(), trace }
    }
    const firstNextPath = extractDataqueryPath(nextButtonTag)
    if (!firstNextPath) {
      trace.push('Tombol "Next Page" ada tapi path tidak bisa diekstrak — berhenti di halaman 1.')
      return { ids: Array.from(allIds).sort(), trace }
    }
    if (lastFirst !== null) {
      const firstNextParams = parseQueryInts(firstNextPath.split("?", 2)[1] ?? "")
      if ((firstNextParams.first ?? 0) >= lastFirst) {
        trace.push("first Next Page >= first Last Page → dianggap sudah halaman terakhir.")
        return { ids: Array.from(allIds).sort(), trace }
      }
    }

    let url = baseUrl.replace(/\/$/, "") + firstNextPath
    for (let i = 0; i < maxPages; i++) {
      res = await session.get(url)
      if (res.status !== 200) {
        trace.push(`Halaman ${i + 2} (${url}) status ${res.status} — berhenti.`)
        break
      }
      html = await safeText(res)
      const before = allIds.size
      collectCheckboxIds(html)
      const gained = allIds.size - before
      trace.push(`Halaman ${i + 2}: +${gained} UID baru (total ${allIds.size}).`)

      // Pengaman utama: begitu satu halaman tidak menambah UID baru sama
      // sekali, anggap sudah mentok halaman terakhir — tidak bergantung
      // pada berhasil-tidaknya parsing tombol "Last Page".
      if (gained === 0) {
        trace.push(`Halaman ${i + 2} tidak ada UID baru → dianggap halaman terakhir, selesai.`)
        break
      }

      if (lastFirst !== null) {
        const qs = url.split("?", 2)[1] ?? ""
        const params = parseQueryInts(qs)
        const curFirst = params.first ?? 0
        const curLast = params.last ?? 0
        if (curFirst >= lastFirst || (lastLast !== null && curLast >= lastLast)) {
          trace.push(`Halaman ${i + 2} first/last (${curFirst}/${curLast}) sudah capai batas terakhir — selesai.`)
          break
        }
      }

      const nextButtonTagIter = findButton(html, "Next Page")
      if (!nextButtonTagIter) {
        trace.push(`Halaman ${i + 2}: tombol "Next Page" tidak ditemukan lagi — berhenti.`)
        break
      }
      const nextPathIter = extractDataqueryPath(nextButtonTagIter)
      if (!nextPathIter) {
        trace.push(`Halaman ${i + 2}: gagal ekstrak path "Next Page" — berhenti.`)
        break
      }
      const newUrl = baseUrl.replace(/\/$/, "") + nextPathIter
      if (newUrl === url) {
        trace.push(`Halaman ${i + 2}: URL "Next Page" tidak berubah — berhenti (anti infinite-loop).`)
        break
      }
      url = newUrl
    }
  } catch (e) {
    if (allIds.size === 0) {
      const message = e instanceof Error ? e.message : String(e)
      return { ids: [], trace, reason: `Gagal membaca daftar user dari mesin: ${message}` }
    }
    // parsial hasil yang sudah terkumpul tetap dipakai
  }

  return { ids: Array.from(allIds).sort(), trace }
}

function isAttlogText(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).slice(0, 3)
  for (const line of lines) {
    const parts = line.split("\t")
    if (parts.length >= 3 && /^\d+$/.test(parts[0].trim())) return true
  }
  return false
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export type DownloadResult = {
  raw: string | null
  reason?: string
  uidsFound: number
  trace: string[]
}

export async function downloadAttlog(
  baseUrl: string,
  session: DeviceSession,
  sdate?: string,
  edate?: string
): Promise<DownloadResult> {
  const payload = new URLSearchParams()
  if (sdate && edate) {
    payload.append("sdate", sdate)
    payload.append("edate", edate)
    payload.append("period", "0")
  } else {
    const today = todayIso()
    payload.append("sdate", today)
    payload.append("edate", today)
    payload.append("period", "1")
  }

  const { ids, reason: idsReason, trace } = await getAllUserIds(baseUrl, session)
  if (ids.length === 0) {
    return { raw: null, reason: idsReason ?? "Tidak ada UID user ditemukan.", uidsFound: 0, trace }
  }
  for (const uid of ids) payload.append("uid", uid)

  try {
    const res = await session.post(`${baseUrl}/form/Download`, payload)
    const contentType = res.headers.get("content-type") ?? ""
    const text = await safeText(res)
    if (contentType.includes("octet") || contentType.includes("binary") || isAttlogText(text)) {
      return { raw: text, uidsFound: ids.length, trace }
    }
    const m = text.match(/["']([^"']+\.dat)["']/)
    if (m) {
      const path = m[1]
      const url = path.startsWith("http") ? path : `${baseUrl}${path}`
      const fileRes = await session.get(url)
      return { raw: await safeText(fileRes), uidsFound: ids.length, trace }
    }
    return {
      raw: null,
      uidsFound: ids.length,
      trace,
      reason: `Response /form/Download tidak dikenali sebagai attlog atau link .dat (status ${res.status}, content-type "${contentType}").`,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { raw: null, uidsFound: ids.length, trace, reason: `Gagal POST /form/Download: ${message}` }
  }
}

export function parseAttlog(raw: string): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  for (const rawLine of raw.trim().split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const parts = line.split("\t")
    if (parts.length < 3) continue
    try {
      const pin = parts[0].trim()
      const name = parts[1].trim()
      const dtStr = parts[2].trim()
      const verify = (parts[3] ?? "0").trim()
      const inoutCd = (parts[4] ?? "0").trim()
      // Format device: "YYYY-MM-DD HH:MM:SS" — jam DINDING WIB (mesin
      // fingerprint di kantor Gresik), TANPA info zona waktu. SENGAJA
      // ditempel offset "+07:00" eksplisit di sini (bukan diserahkan ke
      // timezone proses Node lewat parsing implisit) — supaya instant UTC
      // yang tersimpan ke AttendanceLog.logTime SELALU benar apa pun
      // timezone host yang menjalankan proses ini (server production
      // sempat berjalan tanpa TZ=Asia/Jakarta ter-set, bikin jam absensi
      // salah beberapa jam — lihat juga env TZ di .env/.docker/app/Dockerfile
      // yang membenarkan pembacaan jam LOKAL lain di seluruh app, mis.
      // lib/greeting.ts, lib/attendance/day-summary.ts).
      const dt = new Date(`${dtStr.replace(" ", "T")}+07:00`)
      if (Number.isNaN(dt.getTime())) continue
      records.push({
        userPin: pin,
        name,
        logTime: dt,
        verifyType: VERIFY_MAP[verify] ?? verify,
        logType: INOUT_MAP[inoutCd] ?? inoutCd,
      })
    } catch {
      continue
    }
  }
  return records
}

export async function testDeviceConnection(
  ip: string,
  loginUser: string,
  loginPass: string
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = `http://${ip}`
  const session = new DeviceSession()
  const result = await login(baseUrl, loginUser, loginPass, session)
  if (result.ok) return { ok: true, message: `Berhasil login ke ${ip}` }
  return { ok: false, message: result.reason ?? `Login gagal ke ${ip} — cek IP/username/password` }
}

export type ScrapeResult = {
  records: AttendanceRecord[]
  uidsFound: number
  rawLineCount: number
  trace: string[]
  // Beberapa baris mentah apa adanya (tab diganti " | " biar kelihatan) —
  // buat diagnosis kalau field attlog device ternyata beda urutan/jumlah
  // dari yang diasumsikan parseAttlog (PIN, NAMA, WAKTU, VERIFY, INOUT).
  sampleLines: string[]
}

// Login + download + parse untuk SATU device. Dipakai lib/attendance/sync.ts
// yang menambahkan penyimpanan ke database.
export async function scrapeDevice(
  ip: string,
  loginUser: string,
  loginPass: string,
  sdate?: string,
  edate?: string
): Promise<ScrapeResult> {
  const baseUrl = `http://${ip}`
  const session = new DeviceSession()
  const result = await login(baseUrl, loginUser, loginPass, session)
  if (!result.ok) {
    throw new Error(result.reason ?? "Login gagal, alasan tidak diketahui.")
  }
  const { raw, reason, uidsFound, trace } = await downloadAttlog(baseUrl, session, sdate, edate)
  if (!raw) {
    throw new Error(
      `${reason ?? "Login berhasil tapi tidak ada data attlog yang bisa diunduh."} [${trace.join(" | ")}]`
    )
  }
  const nonEmptyLines = raw
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
  const sampleLines = nonEmptyLines.slice(0, 3).map((l) => l.split("\t").join(" | "))
  return {
    records: parseAttlog(raw),
    uidsFound,
    rawLineCount: nonEmptyLines.length,
    trace,
    sampleLines,
  }
}
