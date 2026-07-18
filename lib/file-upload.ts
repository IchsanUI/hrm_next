import { mkdir, writeFile } from "fs/promises"
import path from "path"

export async function saveUploadedFile(
  file: FormDataEntryValue | null,
  subdir: string,
  employeeId: number
) {
  if (!(file instanceof File) || file.size === 0) return null
  const uploadDir = path.join(process.cwd(), "public", "uploads", subdir)
  await mkdir(uploadDir, { recursive: true })
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const fileName = `${employeeId}-${Date.now()}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDir, fileName), buffer)
  return `/uploads/${subdir}/${fileName}`
}
