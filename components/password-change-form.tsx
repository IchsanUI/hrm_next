"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { updatePasswordAction, type AccountFormState } from "@/server/actions/account";
import { PasswordChecklist } from "@/components/password-checklist";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

// Form ganti password — dipakai Pengaturan Akun (admin & pegawai) dan halaman
// wajib ganti /ganti-password. Validasi kebijakan (kekuatan, bukan
// username/NIP, riwayat) ada di server (updatePasswordAction); setelah
// berhasil pengguna otomatis logout & login ulang dengan password baru.
export function PasswordChangeForm({ submitLabel = "Simpan Password" }: { submitLabel?: string }) {
  const [state, formAction, isPending] = useActionState<AccountFormState, FormData>(updatePasswordAction, undefined);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="currentPassword">Password Saat Ini</Label>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="newPassword">Password Baru</Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordChecklist value={newPassword} />
        <p className="text-xs text-muted-foreground">
          Tidak boleh memuat username/NIP dan tidak boleh sama dengan password yang pernah Anda pakai sebelumnya.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
