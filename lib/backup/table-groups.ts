import type { BackupScope } from "@prisma/client"

// Nama tabel MySQL sungguhan (hasil @@map di prisma/schema.prisma), BUKAN
// nama model Prisma — dipakai langsung sebagai argumen `--tables` ke
// mysqldump (lihat lib/backup/run-backup.ts). `ALL` sengaja tidak punya
// daftar (null) — dump penuh tanpa filter --tables.
export const BACKUP_SCOPE_TABLES: Record<Exclude<BackupScope, "ALL">, string[]> = {
  KEPEGAWAIAN: [
    "employees",
    "departments",
    "positions",
    "work_locations",
    "employment_statuses",
    "work_shifts",
    "work_shift_adjustments",
    "national_holidays",
    "employee_spouses",
    "employee_children",
    "employee_work_histories",
    "employee_trainings",
    "employee_achievements",
    "employee_reward_punishments",
    "employee_mutations",
    "employee_assignment_letters",
    "employee_leave_balances",
    "users",
    "roles",
  ],
  ABSENSI: ["attendance_devices", "attendance_logs", "attendance_settings"],
  PAYROLL: [
    "salary_components",
    "employee_salary_components",
    "salary_grades",
    "salary_scale_versions",
    "salary_grade_rates",
    "ter_rates",
    "bpjs_settings",
    "ptkp_rates",
    "tax_brackets",
    "payroll_settings",
    "payroll_periods",
    "payslips",
    "payslip_items",
    "payroll_manual_entries",
  ],
  IZIN: [
    "overtime_requests",
    "overtime_proofs",
    "overtime_approval_steps",
    "office_exit_requests",
    "office_exit_approval_steps",
    "off_site_attendance_requests",
    "off_site_attendance_approval_steps",
    "attendance_statement_requests",
    "attendance_statement_approval_steps",
    "early_leave_requests",
    "early_leave_approval_steps",
    "late_arrival_requests",
    "late_arrival_approval_steps",
    "sick_leave_requests",
    "sick_leave_approval_steps",
    "cuti_requests",
    "cuti_approval_steps",
    "maternity_leave_requests",
    "maternity_leave_approval_steps",
    "special_leave_requests",
    "special_leave_approval_steps",
    "dispensation_requests",
    "dispensation_approval_steps",
    "cuti_besar_requests",
    "cuti_besar_approval_steps",
    "unpaid_leave_requests",
    "unpaid_leave_approval_steps",
    "izin_type_settings",
    "izin_settings",
    "approval_flows",
    "approval_flow_steps",
  ],
  SISTEM: [
    "push_subscriptions",
    "login_ip_blocks",
    "notifications",
    "activity_logs",
    "team_feed_comments",
    "team_feed_posts",
    "team_feed_likes",
    "team_feed_comment_likes",
  ],
}

export const BACKUP_SCOPE_LABEL: Record<BackupScope, string> = {
  ALL: "Seluruh Database",
  KEPEGAWAIAN: "Kepegawaian",
  ABSENSI: "Absensi",
  PAYROLL: "Payroll",
  IZIN: "Izin & Approval",
  SISTEM: "Sistem & Log",
}

// null = dump penuh tanpa filter --tables (scope ALL).
export function getBackupScopeTables(scope: BackupScope): string[] | null {
  if (scope === "ALL") return null
  return BACKUP_SCOPE_TABLES[scope]
}
