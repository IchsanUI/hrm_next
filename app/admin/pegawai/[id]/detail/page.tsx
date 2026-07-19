import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  IdCard,
  MapPin,
  Crown,
  CalendarDays,
  Building2,
  User,
  Users,
  Wallet,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmployeeSpouseSection } from "@/components/employee-spouse-section";
import { EmployeeChildrenSection } from "@/components/employee-children-section";
import {
  EmployeeWorkHistorySection,
  EmployeeTrainingSection,
  EmployeeAchievementSection,
  EmployeeRewardPunishmentSection,
  EmployeeMutationSection,
  EmployeeAssignmentLetterSection,
} from "@/components/employee-history-sections";
import { EmployeeCvPrint } from "@/components/employee-cv-print";
import { PrintButton } from "@/components/print-button";
import { SpecialLeaveExceptionCard } from "@/components/special-leave-exception-card";
import { CutiBesarExceptionCard } from "@/components/cuti-besar-exception-card";

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

export default async function PegawaiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: publicId } = await params;

  const employee = await prisma.employee.findUnique({
    where: { publicId },
    include: {
      department: true,
      position: true,
      workLocation: true,
      employmentStatus: true,
      workShift: true,
      reportsTo: {
        select: { fullName: true, position: { select: { name: true } } },
      },
      spouse: true,
      children: { orderBy: { birthDate: "asc" } },
      workHistories: { orderBy: { date: "desc" } },
      trainings: { orderBy: { date: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      rewardsPunishments: { orderBy: { date: "desc" } },
      mutations: { orderBy: { date: "desc" } },
      assignmentLetters: { orderBy: { date: "desc" } },
    },
  });

  if (!employee) {
    notFound();
  }

  const headOfDepartment = await prisma.department.findFirst({
    where: { headEmployeeId: employee.id },
    select: { id: true },
  });

  const approvedSpecialLeaves = await prisma.specialLeaveRequest.findMany({
    where: { employeeId: employee.id, status: "APPROVED" },
    select: { type: true },
  });
  const usedHaji = approvedSpecialLeaves.some((r) => r.type === "HAJI");
  const usedUmroh = approvedSpecialLeaves.some((r) => r.type === "UMROH");

  const cutiBesarInstallmentsUsed = await prisma.cutiBesarRequest.count({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING_APPROVAL", "REVISI", "APPROVED"] },
    },
  });

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
    ["Pangkat", employee.rank || "-"],
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
    <>
      <div className="grid gap-6 print:hidden">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Data Pegawai", href: "/admin/pegawai" },
            { label: employee.fullName },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">Detail Pegawai</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href="/admin/pegawai" />}
              nativeButton={false}
            >
              Kembali
            </Button>
            <PrintButton />
            <Button
              render={<Link href={`/admin/pegawai/${employee.publicId}`} />}
              nativeButton={false}
            >
              Edit
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
              <Avatar className="size-24 shrink-0 rounded-xl after:rounded-xl">
                {employee.photoUrl ? (
                  <AvatarImage
                    src={employee.photoUrl}
                    className="rounded-xl object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-xl bg-blue-950 text-xl font-semibold text-white">
                  {employee.fullName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-2.5">
                <div>
                  <p className="text-xl font-bold leading-tight">
                    {employee.fullName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {employee.position.name} &middot; {employee.department.name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <Badge variant="outline" className="gap-1">
                    <IdCard className="size-3" />
                    {employee.nik}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="size-3" />
                    {employee.workLocation.name}
                  </Badge>
                  <Badge variant="outline">
                    {employee.employmentStatus.name}
                  </Badge>
                  {headOfDepartment ? (
                    <Badge className="gap-1">
                      <Crown className="size-3" />
                      Kepala Bagian
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-6 border-t pt-5 sm:justify-end sm:border-t-0 sm:border-l sm:py-1 sm:pl-6">
              <div className="text-center sm:text-right">
                <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-end">
                  <CalendarDays className="size-3.5" />
                  Bergabung
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatDate(employee.startDate)}
                </p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  className="mt-1"
                  variant={employee.isActive ? "default" : "destructive"}
                >
                  {employee.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="umum">
          <TabsList>
            <TabsTrigger value="umum">
              <Building2 className="size-4" />
              Data Umum
            </TabsTrigger>
            <TabsTrigger value="pribadi">
              <User className="size-4" />
              Data Pribadi
            </TabsTrigger>
            <TabsTrigger value="keluarga">
              <Users className="size-4" />
              Keluarga
            </TabsTrigger>
            <TabsTrigger value="payroll">
              <Wallet className="size-4" />
              Data Payroll
            </TabsTrigger>
            <TabsTrigger value="dokumen">
              <FileText className="size-4" />
              Dokumen
            </TabsTrigger>
            <TabsTrigger value="pengecualian">
              <ShieldCheck className="size-4" />
              Pengecualian Cuti
            </TabsTrigger>
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
            <EmployeeSpouseSection
              employeeId={employee.id}
              spouse={employee.spouse}
            />
            <EmployeeChildrenSection
              employeeId={employee.id}
              childrenList={employee.children}
            />
          </TabsPanel>

          <TabsPanel value="payroll">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Modul Data Payroll belum tersedia — akan ditambahkan pada
                pengembangan selanjutnya.
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
                      className="h-[70px] w-[140px] rounded-md border object-contain bg-white"
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
                      className="h-[70px] w-[140px] rounded-md border object-contain bg-white"
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
                  <p className="text-xs text-muted-foreground">
                    Sidik Jari Kiri
                  </p>
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

            <EmployeeWorkHistorySection
              employeeId={employee.id}
              items={employee.workHistories}
            />
            <EmployeeTrainingSection
              employeeId={employee.id}
              items={employee.trainings}
            />
            <EmployeeAchievementSection
              employeeId={employee.id}
              items={employee.achievements}
            />
            <EmployeeRewardPunishmentSection
              employeeId={employee.id}
              items={employee.rewardsPunishments}
            />
            <EmployeeMutationSection
              employeeId={employee.id}
              items={employee.mutations}
            />
            <EmployeeAssignmentLetterSection
              employeeId={employee.id}
              items={employee.assignmentLetters}
            />
          </TabsPanel>

          <TabsPanel value="pengecualian" className="grid gap-6">
            <SpecialLeaveExceptionCard
              employeeId={employee.id}
              usedHaji={usedHaji}
              usedUmroh={usedUmroh}
              exceptionHaji={employee.allowSpecialLeaveExceptionHaji}
              exceptionUmroh={employee.allowSpecialLeaveExceptionUmroh}
            />

            <CutiBesarExceptionCard
              employeeId={employee.id}
              installmentsUsed={cutiBesarInstallmentsUsed}
              exceptionEnabled={employee.allowCutiBesarException}
            />
          </TabsPanel>
        </Tabs>
      </div>
      <EmployeeCvPrint employee={employee} />
    </>
  );
}
