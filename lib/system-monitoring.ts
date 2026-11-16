import { prisma } from "@/lib/prisma"
import { HR_MENU_GROUPS, parseMenuAccess } from "@/lib/hr-menu-access"

// Data untuk Monitoring System → Monitoring Dashboard (khusus SUPER_ADMIN).
// Semua fungsi read-only.

export type DatabaseHealth =
  | {
      ok: true
      latencyMs: number
      version: string
      databaseName: string
      tableCount: number
      sizeBytes: number
      connections: number | null
      uptimeSeconds: number | null
    }
  | { ok: false; latencyMs: number; error: string }

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  // SUM() di MySQL/MariaDB dikembalikan Prisma sebagai Decimal
  if (value && typeof value === "object" && "toString" in value) return Number(String(value)) || 0
  return 0
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Math.round(performance.now() - started)

    const [[meta], [size], status] = await Promise.all([
      prisma.$queryRaw<{ version: string; db: string }[]>`SELECT VERSION() AS version, DATABASE() AS db`,
      prisma.$queryRaw<{ tables: unknown; bytes: unknown }[]>`
        SELECT COUNT(*) AS tables, COALESCE(SUM(data_length + index_length), 0) AS bytes
        FROM information_schema.tables WHERE table_schema = DATABASE()`,
      prisma.$queryRaw<{ Variable_name: string; Value: string }[]>`
        SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Uptime')`.catch(() => []),
    ])
    const statusValue = (name: string) => {
      const row = status.find((s) => s.Variable_name === name)
      return row ? Number(row.Value) : null
    }

    return {
      ok: true,
      latencyMs,
      version: meta?.version ?? "-",
      databaseName: meta?.db ?? "-",
      tableCount: toNumber(size?.tables),
      sizeBytes: toNumber(size?.bytes),
      connections: statusValue("Threads_connected"),
      uptimeSeconds: statusValue("Uptime"),
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message.split("\n").filter(Boolean).pop() ?? err.message : String(err),
    }
  }
}

export type AccessOverview = {
  roleCounts: { role: "SUPER_ADMIN" | "HR_ADMIN" | "EMPLOYEE"; active: number; inactive: number }[]
  lockedUsers: { username: string; lockedAt: Date }[]
  superAdminsWithout2fa: string[]
  hrAdmins: { username: string; menuCount: number }[]
  totalMenuCount: number
  blockedIps: { ip: string; permanent: boolean; blockedUntil: Date | null; lastUsername: string | null }[]
}

export async function getAccessOverview(now = new Date()): Promise<AccessOverview> {
  const [users, blockedIps] = await Promise.all([
    prisma.user.findMany({
      select: {
        username: true,
        isActive: true,
        lockedAt: true,
        totpEnabledAt: true,
        menuAccess: true,
        role: { select: { name: true } },
      },
    }),
    prisma.loginIpBlock.findMany({
      where: { OR: [{ permanentlyBlocked: true }, { blockedUntil: { gt: now } }] },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { ip: true, permanentlyBlocked: true, blockedUntil: true, lastUsername: true },
    }),
  ])

  const roles = ["SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE"] as const
  const roleCounts = roles.map((role) => {
    const inRole = users.filter((u) => u.role.name === role)
    return {
      role,
      active: inRole.filter((u) => u.isActive).length,
      inactive: inRole.filter((u) => !u.isActive).length,
    }
  })

  return {
    roleCounts,
    lockedUsers: users
      .filter((u) => u.lockedAt)
      .map((u) => ({ username: u.username, lockedAt: u.lockedAt as Date })),
    superAdminsWithout2fa: users
      .filter((u) => u.role.name === "SUPER_ADMIN" && u.isActive && !u.totpEnabledAt)
      .map((u) => u.username),
    hrAdmins: users
      .filter((u) => u.role.name === "HR_ADMIN")
      .map((u) => ({ username: u.username, menuCount: parseMenuAccess(u.menuAccess).length }))
      .sort((a, b) => b.menuCount - a.menuCount),
    totalMenuCount: HR_MENU_GROUPS.reduce((sum, g) => sum + g.items.length, 0),
    blockedIps: blockedIps.map((b) => ({
      ip: b.ip,
      permanent: b.permanentlyBlocked,
      blockedUntil: b.blockedUntil,
      lastUsername: b.lastUsername,
    })),
  }
}

export type HourBucket = { hourStart: string; count: number; failed: number }

export type RequestActivity = {
  total: number
  logins: number
  failedLogins: number
  uniqueIps: number
  hourly: HourBucket[] // 24 jam terakhir, urut lama → baru
  topFailedIps: { ip: string; count: number; lastUsername: string }[]
}

// "Request" di sini = aktivitas yang tercatat di Log Aktivitas (login,
// logout, perubahan data, unduhan, dst). Aplikasi tidak mencatat setiap
// HTTP request, jadi ini proksi aktivitas pengguna, bukan access log server.
export async function getRequestActivity(now = new Date()): Promise<RequestActivity> {
  const currentHour = new Date(now)
  currentHour.setMinutes(0, 0, 0)
  const since = new Date(currentHour.getTime() - 23 * 60 * 60 * 1000)

  const logs = await prisma.activityLog.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, action: true, ipAddress: true, username: true },
  })

  const hourly: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hourStart: new Date(since.getTime() + i * 60 * 60 * 1000).toISOString(),
    count: 0,
    failed: 0,
  }))
  const failedByIp = new Map<string, { count: number; lastUsername: string }>()
  const ips = new Set<string>()
  let logins = 0
  let failedLogins = 0

  for (const log of logs) {
    const index = Math.floor((log.createdAt.getTime() - since.getTime()) / (60 * 60 * 1000))
    const bucket = hourly[Math.min(Math.max(index, 0), 23)]
    bucket.count++
    if (log.ipAddress) ips.add(log.ipAddress)
    if (log.action === "LOGIN") logins++
    if (log.action === "LOGIN_FAILED") {
      failedLogins++
      bucket.failed++
      const key = log.ipAddress ?? "(tidak diketahui)"
      const entry = failedByIp.get(key) ?? { count: 0, lastUsername: log.username }
      entry.count++
      entry.lastUsername = log.username
      failedByIp.set(key, entry)
    }
  }

  return {
    total: logs.length,
    logins,
    failedLogins,
    uniqueIps: ips.size,
    hourly,
    topFailedIps: [...failedByIp.entries()]
      .map(([ip, v]) => ({ ip, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}
