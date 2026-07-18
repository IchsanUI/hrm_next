export type OrgTreeEmployee = {
  id: number
  fullName: string
  photoUrl: string | null
  positionName: string
  departmentName: string
  reportsToId: number | null
  isHead: boolean
}

export type OrgTreeNode = Omit<OrgTreeEmployee, "reportsToId"> & {
  children: OrgTreeNode[]
}

export function buildOrgTree(employees: OrgTreeEmployee[]): OrgTreeNode[] {
  const byId = new Map<number, OrgTreeNode>(
    employees.map((e) => [
      e.id,
      {
        id: e.id,
        fullName: e.fullName,
        photoUrl: e.photoUrl,
        positionName: e.positionName,
        departmentName: e.departmentName,
        isHead: e.isHead,
        children: [],
      },
    ])
  )

  const roots: OrgTreeNode[] = []

  for (const employee of employees) {
    const node = byId.get(employee.id)!
    const parent = employee.reportsToId ? byId.get(employee.reportsToId) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function sortRecursive(nodes: OrgTreeNode[]) {
    nodes.sort((a, b) => a.fullName.localeCompare(b.fullName))
    nodes.forEach((n) => sortRecursive(n.children))
  }
  sortRecursive(roots)

  return roots
}
