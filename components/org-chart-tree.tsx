"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Search } from "lucide-react"

import type { OrgTreeNode } from "@/lib/org-tree"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

type LevelInfo = {
  label: string
  variant: "default" | "secondary"
  className: string
}

function getLevelInfo(positionName: string): LevelInfo {
  const name = positionName.toLowerCase()
  if (name.includes("direktur")) {
    return { label: "Direksi", variant: "default", className: "" }
  }
  if (name.includes("kabag")) {
    return {
      label: "Manager",
      variant: "default",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    }
  }
  if (name.includes("kasi") || name.startsWith("kepala")) {
    return {
      label: "Supervisor",
      variant: "default",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    }
  }
  return { label: "Staff", variant: "secondary", className: "" }
}

function matchesSearch(node: OrgTreeNode, term: string) {
  return (
    node.fullName.toLowerCase().includes(term) ||
    node.positionName.toLowerCase().includes(term) ||
    node.departmentName.toLowerCase().includes(term)
  )
}

function filterOrgTree(nodes: OrgTreeNode[], term: string): OrgTreeNode[] {
  const filterNode = (node: OrgTreeNode): OrgTreeNode | null => {
    const filteredChildren = node.children
      .map(filterNode)
      .filter((child): child is OrgTreeNode => child !== null)

    if (matchesSearch(node, term) || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren }
    }
    return null
  }

  return nodes
    .map(filterNode)
    .filter((node): node is OrgTreeNode => node !== null)
}

function OrgNode({
  node,
  depth,
  forceOpen,
}: {
  node: OrgTreeNode
  depth: number
  forceOpen: boolean
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isOpen = forceOpen || open
  const level = getLevelInfo(node.positionName)

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && !forceOpen && setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-default"
        disabled={!hasChildren}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{node.fullName}</span>
            <Badge variant={level.variant} className={level.className}>
              {level.label}
            </Badge>
            {node.isHead ? (
              <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                Kepala Bagian
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {node.positionName} · {node.departmentName}
          </p>
        </div>
        {hasChildren ? (
          <span className="shrink-0 text-sm text-muted-foreground">
            {node.children.length} bawahan
          </span>
        ) : null}
      </button>

      {hasChildren && isOpen ? (
        <div className="mt-1.5 ml-4 space-y-1.5 border-l pl-4">
          {node.children.map((child) => (
            <OrgNode
              key={child.id}
              node={child}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function OrgChartTree({ roots }: { roots: OrgTreeNode[] }) {
  const [search, setSearch] = useState("")
  const term = search.trim().toLowerCase()
  const isSearching = term.length > 0

  const displayedRoots = useMemo(
    () => (isSearching ? filterOrgTree(roots, term) : roots),
    [roots, term, isSearching]
  )

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nama, jabatan, atau departemen..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className={cn("rounded-xl border p-3", "space-y-1.5")}>
        {displayedRoots.length ? (
          displayedRoots.map((root) => (
            <OrgNode
              key={root.id}
              node={root}
              depth={0}
              forceOpen={isSearching}
            />
          ))
        ) : (
          <p className="p-4 text-center text-muted-foreground">
            {isSearching
              ? "Tidak ada pegawai yang cocok."
              : "Belum ada data struktur organisasi."}
          </p>
        )}
      </div>
    </div>
  )
}
