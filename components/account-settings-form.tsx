"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateUsernameAction,
  updatePasswordAction,
  updateAccountAvatarAction,
  removeAccountAvatarAction,
  type AccountFormState,
} from "@/server/actions/account";
import { PasswordChecklist } from "@/components/password-checklist";
import { EmployeeImageUpload } from "@/components/employee-image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export function AccountSettingsForm({
  currentUsername,
  currentAvatarUrl,
}: {
  currentUsername: string;
  currentAvatarUrl: string | null;
}) {
  const [isRemoving, startRemoveTransition] = useTransition();

  function handleRemoveAvatar() {
    startRemoveTransition(async () => {
      const result = await removeAccountAvatarAction();
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Foto profil berhasil dihapus.");
      }
    });
  }

  const [usernameState, usernameAction, isUsernamePending] = useActionState<
    AccountFormState,
    FormData
  >(updateUsernameAction, undefined);

  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    AccountFormState,
    FormData
  >(updatePasswordAction, undefined);

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (usernameState?.error) toast.error(usernameState.error);
  }, [usernameState]);

  useEffect(() => {
    if (passwordState?.error) toast.error(passwordState.error);
  }, [passwordState]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Foto Profil</CardTitle>
          <CardDescription>
            Foto ini cuma tampilan akun Anda (mis. di pojok kanan atas) TIDAK
            menggantikan foto resmi di Data Pegawai.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <EmployeeImageUpload
            label="Foto Profil"
            fieldName="avatar"
            action={updateAccountAvatarAction}
            currentUrl={currentAvatarUrl}
            width={100}
            height={100}
            imageClassName="size-[100px] rounded-full border object-cover"
            emptyLabel="Tanpa Foto"
          />
          {currentAvatarUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRemoving}
              onClick={handleRemoveAvatar}
            >
              {isRemoving ? "Menghapus..." : "Hapus Foto"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Ubah Username</CardTitle>
            <CardDescription>
              Username saat ini:{" "}
              <span className="font-medium text-foreground">
                {currentUsername}
              </span>
              . Setelah diubah, Anda akan diminta login ulang.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={usernameAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username Baru</Label>
                <Input
                  id="username"
                  name="username"
                  defaultValue={currentUsername}
                  required
                />
              </div>
              {usernameState?.error ? (
                <p className="text-destructive text-sm">
                  {usernameState.error}
                </p>
              ) : null}
              <div>
                <Button type="submit" disabled={isUsernamePending}>
                  {isUsernamePending ? "Menyimpan..." : "Simpan Username"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ubah Password</CardTitle>
            <CardDescription>
              Setelah diubah, Anda akan diminta login ulang dengan password
              baru.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={passwordAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <PasswordInput
                  id="currentPassword"
                  name="currentPassword"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <PasswordChecklist value={newPassword} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">
                  Konfirmasi Password Baru
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                />
              </div>
              {passwordState?.error ? (
                <p className="text-destructive text-sm">
                  {passwordState.error}
                </p>
              ) : null}
              <div>
                <Button type="submit" disabled={isPasswordPending}>
                  {isPasswordPending ? "Menyimpan..." : "Simpan Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
