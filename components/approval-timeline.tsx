import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Flag,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  APPROVER_TYPE_LABEL,
  type ApproverType,
} from "@/lib/approval-step-labels";
import { cn } from "@/lib/utils";

export type ApprovalStepRow = {
  id: number;
  order: number;
  approverType: ApproverType;
  approverName: string | null;
  status:
    | "WAITING"
    | "IN_PROGRESS"
    | "APPROVED"
    | "REJECTED"
    | "SKIPPED"
    | "REVISED";
  notes: string | null;
  actedAt: string | null;
};

const STATUS_LABEL: Record<ApprovalStepRow["status"], string> = {
  WAITING: "Menunggu Giliran",
  IN_PROGRESS: "Sedang Diproses",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  SKIPPED: "Dilewati",
  REVISED: "Tidak Bersedia",
};

const STATUS_VARIANT: Record<
  ApprovalStepRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  WAITING: "outline",
  IN_PROGRESS: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  SKIPPED: "outline",
  REVISED: "secondary",
};

const STATUS_ICON: Record<ApprovalStepRow["status"], typeof Clock> = {
  WAITING: CircleDashed,
  IN_PROGRESS: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  SKIPPED: CircleDashed,
  REVISED: AlertCircle,
};

// Status akhir pengajuan secara keseluruhan — dipakai buat nampilin node
// penutup di timeline, supaya jelas alurnya sudah tuntas atau masih berjalan
// (penting terutama kalau step terakhir yang beneran jalan itu di-skip, jadi
// tidak kelihatan seperti berhenti di tengah).
export type ApprovalFinalStatus = "PENDING" | "APPROVED" | "REJECTED";

const FINAL_LABEL: Record<ApprovalFinalStatus, string> = {
  PENDING: "Menunggu Keputusan Akhir",
  APPROVED: "Selesai - Disetujui",
  REJECTED: "Selesai - Ditolak",
};

const FINAL_VARIANT: Record<
  ApprovalFinalStatus,
  "default" | "destructive" | "outline"
> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
};

const FINAL_ICON: Record<ApprovalFinalStatus, typeof Clock> = {
  PENDING: CircleDashed,
  APPROVED: Flag,
  REJECTED: Flag,
};

export function ApprovalTimeline({
  steps,
  finalStatus,
  submittedAt,
}: {
  steps: ApprovalStepRow[];
  finalStatus: ApprovalFinalStatus;
  // Jam pengajuan awal oleh pegawai — dipakai buat node pembuka "Step 1.
  // Pengajuan Pegawai" (step approver di database tetap mulai dari order 1,
  // tapi di timeline digeser tampil jadi "Step 2" dst supaya pengajuan
  // dihitung sebagai langkah pertama).
  submittedAt: string;
}) {
  // Node penutup "Selesai" nampilin jam keputusan akhir — diambil dari
  // actedAt step TERAKHIR yang sudah diproses (bukan cuma step paling
  // bawah di array, karena step-step setelah REJECTED/REVISED bisa saja
  // belum actedAt sama sekali).
  const lastActedAt =
    [...steps].reverse().find((step) => step.actedAt)?.actedAt ?? null;

  return (
    <ol className="grid gap-1">
      <li className="relative flex items-start gap-3 pb-4">
        <span className="absolute top-8 left-[15px] h-[calc(100%-1rem)] w-px bg-border" />
        <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Send className="size-4" />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium">Step 1. Pengajuan Pegawai</p>
          <p className="mt-1 text-xs text-muted-foreground">{submittedAt}</p>
        </div>
      </li>
      {steps.map((step, index) => {
        const Icon = STATUS_ICON[step.status];
        const isActive = step.status === "IN_PROGRESS";
        return (
          <li
            key={step.id}
            className="relative flex items-start gap-3 pb-4 last:pb-0"
          >
            <span className="absolute top-8 left-[15px] h-[calc(100%-1rem)] w-px bg-border" />
            <span
              className={cn(
                "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  Step {index + 2}. {APPROVER_TYPE_LABEL[step.approverType]}
                  {step.approverName ? ` | ${step.approverName}` : ""}
                </p>
                <Badge variant={STATUS_VARIANT[step.status]}>
                  {STATUS_LABEL[step.status]}
                </Badge>
              </div>
              {step.actedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.actedAt}
                </p>
              ) : null}
              {step.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.notes}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
      <li className="relative flex items-start gap-3">
        <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {(() => {
            const FinalIcon = FINAL_ICON[finalStatus];
            return <FinalIcon className="size-4" />;
          })()}
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium">Selesai</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={FINAL_VARIANT[finalStatus]}>
              {FINAL_LABEL[finalStatus]}
            </Badge>
          </div>
          {lastActedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">{lastActedAt}</p>
          ) : null}
        </div>
      </li>
    </ol>
  );
}
