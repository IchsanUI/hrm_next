import { prisma } from "@/lib/prisma"
import {
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
} from "@/server/actions/positions"
import { Breadcrumb } from "@/components/breadcrumb"
import { SimpleMasterTable } from "@/components/simple-master-table"

export default async function JabatanPage() {
  const positions = await prisma.position.findMany({
    orderBy: { name: "asc" },
  })

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Data Jabatan" },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Data Jabatan</h1>
      <SimpleMasterTable
        title="Daftar Jabatan"
        addLabel="Tambah Jabatan"
        items={positions}
        createAction={createPositionAction}
        updateAction={updatePositionAction}
        deleteAction={deletePositionAction}
      />
    </div>
  )
}
