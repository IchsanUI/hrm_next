import Image from "next/image";
import Link from "next/link";
import { IdCard, MapPin, CalendarDays } from "lucide-react";

import type { FullEmployeeProfile } from "@/lib/employee-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { EmployeeSelfUpdateForm } from "@/components/employee-self-update-form";

export type ProfileEmployee = FullEmployeeProfile;

const GENDER_LABEL: Record<string, string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
};

const MARITAL_LABEL: Record<string, string> = {
  SINGLE: "Belum Menikah",
  MARRIED: "Menikah",
  DIVORCED: "Cerai",
  WIDOWED: "Janda/Duda",
};

const WORK_SHIFT_TYPE_LABEL: Record<string, string> = {
  PEGAWAI: "Jam Pegawai",
  OUTSOURCING: "Jam Outsourcing",
};

const REWARD_PUNISHMENT_LABEL: Record<string, string> = {
  REWARD: "Penghargaan",
  PUNISHMENT: "Punishment",
};

function formatTime(date: Date) {
  return date.toISOString().slice(11, 16);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FieldGrid({ fields }: { fields: [string, string][] }) {
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium break-words">{value}</p>
        </div>
      ))}
    </div>
  );
}

function FileLink({ fileUrl }: { fileUrl: string | null }) {
  return fileUrl ? (
    <Link
      href={fileUrl}
      target="_blank"
      className="text-xs text-primary underline-offset-4 hover:underline"
    >
      Lihat File
    </Link>
  ) : null;
}

function HistoryList({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: { id: number; date: string; title: string; fileUrl?: string | null }[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
    );
  }
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.date}</p>
            <p className="text-sm break-words">{item.title}</p>
          </div>
          <FileLink fileUrl={item.fileUrl ?? null} />
        </li>
      ))}
    </ul>
  );
}

export function EmployeeProfileView({
  employee,
}: {
  employee: ProfileEmployee;
}) {
  const employmentFields: [string, string][] = [
    ["NIP", employee.employeeNumber],
    ["PIN Mesin Absensi", employee.pinAttendance || "-"],
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
  ];

  const personalFields: [string, string][] = [
    ["Jenis Kelamin", GENDER_LABEL[employee.gender]],
    [
      "Tempat, Tanggal Lahir",
      `${employee.birthPlace}, ${formatDate(employee.birthDate)}`,
    ],
    [
      "Status Diri",
      employee.maritalStatus ? MARITAL_LABEL[employee.maritalStatus] : "-",
    ],
    ["NIK", employee.nik],
    ["Pendidikan Terakhir", employee.lastEducation || "-"],
    ["Jurusan", employee.major || "-"],
    ["Gelar", employee.degree || "-"],
    ["Nama Ayah Kandung", employee.fatherName || "-"],
    ["Nama Ibu Kandung", employee.motherName || "-"],
    ["Penyakit Bawaan", employee.illness || "-"],
    ["Hobi", employee.hobby || "-"],
    ["Usaha di Luar Pekerjaan", employee.sideBusiness || "-"],
  ];

  const addressFields: [string, string][] = [
    ["Alamat Domisili", employee.address],
    ["Alamat KTP", employee.ktpAddress || "-"],
  ];

  const contactFields: [string, string][] = [
    ["No HP", employee.phone],
    ["No HP Urgent", employee.emergencyPhone || "-"],
    ["Email", employee.email],
    ["Instagram", employee.instagram || "-"],
    ["Facebook", employee.facebook || "-"],
    ["Tiktok", employee.tiktok || "-"],
  ];

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-5  text-center sm:flex-row sm:items-center sm:text-left">
          <Avatar className="size-24 shrink-0 rounded-full after:rounded-full">
            {employee.photoUrl ? (
              <AvatarImage
                src={employee.photoUrl}
                className="rounded-full object-cover"
              />
            ) : null}
            <AvatarFallback className="rounded-full bg-blue-950 text-xl font-semibold text-white">
              {employee.fullName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-xl font-bold">{employee.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {employee.position.name} &middot; {employee.department.name}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <Badge variant="outline" className="gap-1">
                <IdCard className="size-3" />
                NIP {employee.employeeNumber}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <MapPin className="size-3" />
                {employee.workLocation.name}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="size-3" />
                Sejak {formatDate(employee.startDate)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {employee.allowSelfUpdate ? (
        <EmployeeSelfUpdateForm
          initial={{
            phone: employee.phone,
            email: employee.email,
            address: employee.address,
            emergencyPhone: employee.emergencyPhone,
            instagram: employee.instagram,
            tiktok: employee.tiktok,
            facebook: employee.facebook,
            ktpAddress: employee.ktpAddress,
          }}
        />
      ) : null}

      <Tabs defaultValue="umum">
        <TabsList>
          <TabsTrigger value="umum">Data Umum</TabsTrigger>
          <TabsTrigger value="pribadi">Data Pribadi</TabsTrigger>
          <TabsTrigger value="keluarga">Keluarga</TabsTrigger>
          <TabsTrigger value="dokumen">Dokumen</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
        </TabsList>

        <TabsPanel value="umum" className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Informasi Kepegawaian</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGrid fields={employmentFields} />
            </CardContent>
          </Card>
        </TabsPanel>

        <TabsPanel value="pribadi" className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Data Pribadi</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGrid fields={personalFields} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Alamat</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGrid fields={addressFields} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Kontak &amp; Media Sosial</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGrid fields={contactFields} />
            </CardContent>
          </Card>
        </TabsPanel>

        <TabsPanel value="keluarga" className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Pasangan</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {employee.spouse ? (
                <FieldGrid
                  fields={[
                    ["Nama", employee.spouse.fullName],
                    ["Pekerjaan", employee.spouse.occupation || "-"],
                    [
                      "Tempat, Tanggal Lahir",
                      employee.spouse.birthDate
                        ? `${employee.spouse.birthPlace || "-"}, ${formatDate(employee.spouse.birthDate)}`
                        : employee.spouse.birthPlace || "-",
                    ],
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Belum ada data pasangan.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Anak</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {employee.children.length > 0 ? (
                <ul className="grid gap-3">
                  {employee.children.map((child) => (
                    <li
                      key={child.id}
                      className="border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-sm font-medium">{child.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {child.birthPlace || "-"}
                        {child.birthDate
                          ? `, ${formatDate(child.birthDate)}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Belum ada data anak.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsPanel>

        <TabsPanel value="dokumen" className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Tanda Tangan &amp; Dokumen Identitas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Tanda Tangan</p>
                {employee.signatureUrl ? (
                  <Image
                    src={employee.signatureUrl}
                    alt="Tanda tangan"
                    width={140}
                    height={70}
                    className="h-[70px] w-[140px] rounded-md border bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-[70px] w-[140px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                    Tanpa TTD
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Paraf</p>
                {employee.initialsUrl ? (
                  <Image
                    src={employee.initialsUrl}
                    alt="Paraf"
                    width={140}
                    height={70}
                    className="h-[70px] w-[140px] rounded-md border bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-[70px] w-[140px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                    Tanpa Paraf
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">
                  Sidik Jari Kanan
                </p>
                {employee.fingerprintRightUrl ? (
                  <Image
                    src={employee.fingerprintRightUrl}
                    alt="Sidik jari kanan"
                    width={100}
                    height={100}
                    className="size-[100px] rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex size-[100px] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    No Image
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">Sidik Jari Kiri</p>
                {employee.fingerprintLeftUrl ? (
                  <Image
                    src={employee.fingerprintLeftUrl}
                    alt="Sidik jari kiri"
                    width={100}
                    height={100}
                    className="size-[100px] rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex size-[100px] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    No Image
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsPanel>

        <TabsPanel value="riwayat" className="grid gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Riwayat Pekerjaan</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada riwayat pekerjaan."
                items={employee.workHistories.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title: h.description,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Pelatihan</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada riwayat pelatihan."
                items={employee.trainings.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title: h.description,
                  fileUrl: h.fileUrl,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Prestasi</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada riwayat prestasi."
                items={employee.achievements.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title: h.description,
                  fileUrl: h.fileUrl,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Penghargaan &amp; Punishment</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada riwayat penghargaan/punishment."
                items={employee.rewardsPunishments.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title: `${REWARD_PUNISHMENT_LABEL[h.type]} — ${h.description}`,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Mutasi</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada riwayat mutasi."
                items={employee.mutations.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title:
                    [h.oldPosition, h.newPosition]
                      .filter(Boolean)
                      .join(" → ") ||
                    h.description ||
                    "-",
                  fileUrl: h.fileUrl,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Surat Tugas</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HistoryList
                emptyMessage="Belum ada surat tugas."
                items={employee.assignmentLetters.map((h) => ({
                  id: h.id,
                  date: formatDate(h.date),
                  title: h.description,
                  fileUrl: h.fileUrl,
                }))}
              />
            </CardContent>
          </Card>
        </TabsPanel>
      </Tabs>
    </div>
  );
}
