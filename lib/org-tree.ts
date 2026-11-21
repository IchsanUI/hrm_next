export type OrgTreeEmployee = {
  id: number
  fullName: string
  photoUrl: string | null
  positionName: string
  departmentName: string
  reportsToId: number | null
  isHead: boolean
}

// Pihak di luar kepegawaian (mis. Bupati, Dewan Pengawas) — lihat model
// OrgExternalNode. childEmployeeIds hanya berlaku untuk pegawai yang TIDAK
// punya atasan internal (atasan internal selalu didahulukan).
export type OrgTreeExternal = {
  id: number
  name: string
  title: string
  organization: string | null
  parentExternalId: number | null
  parentEmployeeId: number | null
  childEmployeeIds: number[]
  sortOrder: number
}

export type OrgTreeNode = {
  key: string // "e-12" pegawai, "x-3" pihak luar — unik lintas jenis
  kind: "employee" | "external"
  id: number
  fullName: string
  photoUrl: string | null
  positionName: string
  departmentName: string
  isHead: boolean
  children: OrgTreeNode[]
}

const employeeKey = (id: number) => `e-${id}`
const externalKey = (id: number) => `x-${id}`

export function parseChildEmployeeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
}

// Induk tiap node (key → key induk). Pegawai: atasan internal, lalu pihak
// luar yang membawahinya. Pihak luar: pihak luar induk, lalu pegawai induk.
function resolveParents(employees: OrgTreeEmployee[], externals: OrgTreeExternal[]) {
  const employeeIds = new Set(employees.map((e) => e.id))
  const externalIds = new Set(externals.map((x) => x.id))
  const parent = new Map<string, string | null>()

  const externalOfEmployee = new Map<number, number>()
  for (const x of [...externals].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)) {
    for (const eid of x.childEmployeeIds) if (!externalOfEmployee.has(eid)) externalOfEmployee.set(eid, x.id)
  }

  for (const e of employees) {
    const internal = e.reportsToId && employeeIds.has(e.reportsToId) ? employeeKey(e.reportsToId) : null
    const external = externalOfEmployee.get(e.id)
    parent.set(employeeKey(e.id), internal ?? (external !== undefined ? externalKey(external) : null))
  }
  for (const x of externals) {
    const p =
      x.parentExternalId && externalIds.has(x.parentExternalId)
        ? externalKey(x.parentExternalId)
        : x.parentEmployeeId && employeeIds.has(x.parentEmployeeId)
          ? employeeKey(x.parentEmployeeId)
          : null
    parent.set(externalKey(x.id), p)
  }
  return parent
}

// Key node yang induk-nya membentuk lingkaran (mis. Bupati membawahi Dirut
// tapi Bupati diletakkan di bawah Dirut). Dipakai untuk validasi simpan &
// sebagai pengaman saat menyusun bagan.
export function findOrgCycleKeys(employees: OrgTreeEmployee[], externals: OrgTreeExternal[]): Set<string> {
  const parent = resolveParents(employees, externals)
  const inCycle = new Set<string>()
  for (const start of parent.keys()) {
    const seen = new Set<string>()
    let cur: string | null | undefined = start
    while (cur) {
      if (seen.has(cur)) {
        if (cur === start) inCycle.add(start)
        break
      }
      seen.add(cur)
      cur = parent.get(cur)
    }
  }
  return inCycle
}

export function buildOrgTree(employees: OrgTreeEmployee[], externals: OrgTreeExternal[] = []): OrgTreeNode[] {
  const nodes = new Map<string, OrgTreeNode>()
  for (const e of employees) {
    nodes.set(employeeKey(e.id), {
      key: employeeKey(e.id),
      kind: "employee",
      id: e.id,
      fullName: e.fullName,
      photoUrl: e.photoUrl,
      positionName: e.positionName,
      departmentName: e.departmentName,
      isHead: e.isHead,
      children: [],
    })
  }
  const externalOrder = new Map(externals.map((x) => [externalKey(x.id), x.sortOrder]))
  for (const x of externals) {
    nodes.set(externalKey(x.id), {
      key: externalKey(x.id),
      kind: "external",
      id: x.id,
      fullName: x.name,
      photoUrl: null,
      positionName: x.title,
      departmentName: x.organization ?? "",
      isHead: false,
      children: [],
    })
  }

  const parent = resolveParents(employees, externals)
  // Pengaman: node dalam lingkaran dijadikan akar supaya bagan tetap tergambar.
  for (const key of findOrgCycleKeys(employees, externals)) parent.set(key, null)

  const roots: OrgTreeNode[] = []
  for (const [key, node] of nodes) {
    const p = parent.get(key)
    const parentNode = p ? nodes.get(p) : undefined
    if (parentNode) parentNode.children.push(node)
    else roots.push(node)
  }

  // Pihak luar lebih dulu (sesuai urutan), lalu pegawai berdasarkan nama.
  const compare = (a: OrgTreeNode, b: OrgTreeNode) => {
    if (a.kind !== b.kind) return a.kind === "external" ? -1 : 1
    if (a.kind === "external") return (externalOrder.get(a.key) ?? 0) - (externalOrder.get(b.key) ?? 0) || a.id - b.id
    return a.fullName.localeCompare(b.fullName)
  }
  function sortRecursive(list: OrgTreeNode[]) {
    list.sort(compare)
    list.forEach((n) => sortRecursive(n.children))
  }
  sortRecursive(roots)
  return roots
}
