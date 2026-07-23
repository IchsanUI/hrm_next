import Image from "next/image"
import type { Prisma } from "@prisma/client"

export type EmployeeCvPayload = Prisma.EmployeeGetPayload<{
  include: {
    department: true
    position: true
    workLocation: true
    employmentStatus: true
    workShift: true
    salaryGrade: true
    reportsTo: { select: { fullName: true; position: { select: { name: true } } } }
    spouse: true
    children: true
    workHistories: true
    trainings: true
    achievements: true
    rewardsPunishments: true
    mutations: true
    assignmentLetters: true
  }
}>

const GENDER_LABEL: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
}

const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Belum Menikah",
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda/Duda",
}

const WORK_SHIFT_TYPE_LABEL: Record<string, string> = {
  PEGAWAI: "Jam Pegawai",
  OUTSOURCING: "Jam Outsourcing",
}

const REWARD_PUNISHMENT_LABEL: Record<string, string> = {
  REWARD: "Reward",
  PUNISHMENT: "Punishment",
}

function formatDate(date: Date | null) {
  if (!date) return "-"
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTime(date: Date) {
  return date.toISOString().slice(11, 16)
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid pt-4">
      <h2 className="border-b-2 border-black pb-1 text-[11px] font-bold tracking-wide uppercase">
        {title}
      </h2>
      <div className="pt-2">{children}</div>
    </section>
  )
}

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10.5px]">
      {fields.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[110px_auto_1fr] gap-1">
          <span className="text-neutral-600">{label}</span>
          <span>:</span>
          <span className="font-medium break-words">{value}</span>
        </div>
      ))}
    </div>
  )
}

function CvTable({
  head,
  rows,
  emptyMessage,
}: {
  head: string[]
  rows: (string | null)[][]
  emptyMessage: string
}) {
  if (rows.length === 0) {
    return <p className="text-[10.5px] text-neutral-500 italic">{emptyMessage}</p>
  }
  return (
    <table className="w-full border-collapse text-[10.5px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th
              key={h}
              className="border border-neutral-400 bg-neutral-100 px-2 py-1 text-left font-semibold"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="border border-neutral-300 px-2 py-1 align-top">
                {cell || "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EmployeeCvPrint({ employee }: { employee: EmployeeCvPayload }) {
  const employmentFields: [string, string][] = [
    ["NIP", employee.employeeNumber],
    ["Jabatan", employee.position.name],
    ["Bagian", employee.department.name],
    ["Status Pekerjaan", employee.employmentStatus.name],
    ["Mulai Kerja", formatDate(employee.startDate)],
    ["Lokasi Kerja", employee.workLocation.name],
    [
      "Jam Kerja",
      employee.workShift
        ? `${employee.workShift.name} (${WORK_SHIFT_TYPE_LABEL[employee.workShift.type]}, ${formatTime(employee.workShift.checkInTime)}-${formatTime(employee.workShift.checkOutTime)})`
        : "-",
    ],
    [
      "Melapor Kepada",
      employee.reportsTo
        ? `${employee.reportsTo.fullName} — ${employee.reportsTo.position.name}`
        : "-",
    ],
    [
      "Golongan",
      employee.salaryGrade
        ? `${employee.salaryGrade.code}-${employee.salaryGrade.subGrade}${
            employee.salaryGradeStep !== null ? `/${employee.salaryGradeStep}` : ""
          }`
        : "-",
    ],
    ["Surat Keluar", employee.exitLetterNumber || "-"],
  ]

  const personalFields: [string, string][] = [
    ["Jenis Kelamin", GENDER_LABEL[employee.gender]],
    ["Tempat, Tanggal Lahir", `${employee.birthPlace}, ${formatDate(employee.birthDate)}`],
    ["Status Diri", employee.maritalStatus ? MARITAL_LABEL[employee.maritalStatus] : "-"],
    ["NIK", employee.nik],
    ["Pendidikan Terakhir", employee.lastEducation || "-"],
    ["Jurusan", employee.major || "-"],
    ["Gelar", employee.degree || "-"],
    ["Nama Ayah Kandung", employee.fatherName || "-"],
    ["Nama Ibu Kandung", employee.motherName || "-"],
    ["Penyakit Bawaan", employee.illness || "-"],
    ["Hobi", employee.hobby || "-"],
    ["Usaha di Luar Pekerjaan", employee.sideBusiness || "-"],
  ]

  const addressFields: [string, string][] = [
    ["Alamat Domisili", employee.address],
    ["Alamat KTP", employee.ktpAddress || "-"],
  ]

  const contactFields: [string, string][] = [
    ["No HP", employee.phone],
    ["No HP Urgent", employee.emergencyPhone || "-"],
    ["Email", employee.email],
    ["Instagram", employee.instagram || "-"],
    ["Facebook", employee.facebook || "-"],
    ["Tiktok", employee.tiktok || "-"],
  ]

  return (
    <div className="hidden bg-white text-black print:block">
      <div className="flex items-center gap-5 border-b-4 border-black pb-4">
        {employee.photoUrl ? (
          <Image
            src={employee.photoUrl}
            alt={employee.fullName}
            width={90}
            height={90}
            className="size-[90px] rounded-md border border-neutral-400 object-cover"
          />
        ) : (
          <div className="flex size-[90px] items-center justify-center rounded-md border border-dashed border-neutral-400 text-[9px] text-neutral-500">
            Tanpa Foto
          </div>
        )}
        <div className="flex-1">
          <p className="text-xl font-bold">{employee.fullName}</p>
          <p className="text-sm text-neutral-700">
            {employee.position.name} &middot; {employee.department.name}
          </p>
          <p className="text-sm text-neutral-700">NIP {employee.employeeNumber}</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center">
            <p className="mb-1 text-[9px] text-neutral-500">Tanda Tangan</p>
            {employee.signatureUrl ? (
              <Image
                src={employee.signatureUrl}
                alt="Tanda tangan"
                width={110}
                height={55}
                className="h-[55px] w-[110px] object-contain"
              />
            ) : (
              <div className="flex h-[55px] w-[110px] items-center justify-center border border-dashed border-neutral-400 text-[8px] text-neutral-500">
                Tanpa TTD
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="mb-1 text-[9px] text-neutral-500">Paraf</p>
            {employee.initialsUrl ? (
              <Image
                src={employee.initialsUrl}
                alt="Paraf"
                width={110}
                height={55}
                className="h-[55px] w-[110px] object-contain"
              />
            ) : (
              <div className="flex h-[55px] w-[110px] items-center justify-center border border-dashed border-neutral-400 text-[8px] text-neutral-500">
                Tanpa Paraf
              </div>
            )}
          </div>
        </div>
      </div>

      <CvSection title="Informasi Kepegawaian">
        <FieldGrid fields={employmentFields} />
      </CvSection>

      <CvSection title="Data Pribadi">
        <FieldGrid fields={personalFields} />
      </CvSection>

      <CvSection title="Alamat">
        <FieldGrid fields={addressFields} />
      </CvSection>

      <CvSection title="Kontak & Media Sosial">
        <FieldGrid fields={contactFields} />
      </CvSection>

      <CvSection title="Data Keluarga">
        {employee.spouse ? (
          <FieldGrid
            fields={[
              ["Nama Suami/Istri", employee.spouse.fullName],
              ["Pekerjaan", employee.spouse.occupation || "-"],
              [
                "Tempat/Tanggal Lahir",
                `${employee.spouse.birthPlace || "-"}${employee.spouse.birthDate ? `, ${formatDate(employee.spouse.birthDate)}` : ""}`,
              ],
            ]}
          />
        ) : (
          <p className="text-[10.5px] text-neutral-500 italic">Belum ada data pasangan.</p>
        )}
        <div className="mt-2">
          <CvTable
            head={["Nama Anak", "Tempat Lahir", "Tanggal Lahir"]}
            rows={employee.children.map((c) => [
              c.fullName,
              c.birthPlace,
              formatDate(c.birthDate),
            ])}
            emptyMessage="Belum ada data anak."
          />
        </div>
      </CvSection>

      <CvSection title="Riwayat Pekerjaan">
        <CvTable
          head={["Tanggal", "Uraian"]}
          rows={employee.workHistories.map((h) => [formatDate(h.date), h.description])}
          emptyMessage="Belum ada riwayat pekerjaan."
        />
      </CvSection>

      <CvSection title="Riwayat Pendidikan dan Pelatihan">
        <CvTable
          head={["Tanggal", "Uraian"]}
          rows={employee.trainings.map((t) => [formatDate(t.date), t.description])}
          emptyMessage="Belum ada riwayat pelatihan."
        />
      </CvSection>

      <CvSection title="Data Prestasi">
        <CvTable
          head={["Tanggal", "Uraian"]}
          rows={employee.achievements.map((a) => [formatDate(a.date), a.description])}
          emptyMessage="Belum ada data prestasi."
        />
      </CvSection>

      <CvSection title="Data Reward / Punishment">
        <CvTable
          head={["Tanggal", "Jenis", "Uraian"]}
          rows={employee.rewardsPunishments.map((r) => [
            formatDate(r.date),
            REWARD_PUNISHMENT_LABEL[r.type],
            r.description,
          ])}
          emptyMessage="Belum ada data reward/punishment."
        />
      </CvSection>

      <CvSection title="Data Mutasi Pegawai">
        <CvTable
          head={["Tanggal", "Jabatan Lama", "Jabatan Baru", "Uraian"]}
          rows={employee.mutations.map((m) => [
            formatDate(m.date),
            m.oldPosition,
            m.newPosition,
            m.description,
          ])}
          emptyMessage="Belum ada data mutasi."
        />
      </CvSection>

      <CvSection title="Data Surat Tugas Pegawai">
        <CvTable
          head={["Tanggal", "Uraian"]}
          rows={employee.assignmentLetters.map((s) => [formatDate(s.date), s.description])}
          emptyMessage="Belum ada surat tugas."
        />
      </CvSection>

      <p className="mt-6 text-[9px] text-neutral-500">
        Dicetak pada {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
      </p>
    </div>
  )
}
