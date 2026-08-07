"use client";

import { Children, useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateUsernameAction,
  updatePasswordAction,
  removeAccountAvatarAction,
  type AccountFormState,
} from "@/server/actions/account";
import { PasswordChecklist } from "@/components/password-checklist";
import { AccountAvatarUpload } from "@/components/account-avatar-upload";
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
  extraCards,
}: {
  currentUsername: string;
  currentAvatarUrl: string | null;
  // Kartu tambahan milik halaman pemanggil (mis. status 2FA khusus
  // SUPER_ADMIN, toggle notifikasi push) — ikut mengalir di masonry yang
  // sama, BUKAN jadi section full-width terpisah di bawah. Sengaja ARRAY
  // (bukan ReactNode/fragment) supaya Children.toArray bisa membungkus tiap
  // kartu satu per satu dengan break-inside-avoid; fragment tidak diratakan
  // oleh toArray dan akan terhitung sebagai satu blok raksasa.
  extraCards?: React.ReactNode[];
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
    // Masonry lewat CSS multi-column, BUKAN grid — tinggi tiap kartu di sini
    // beda jauh (Ubah Password jauh lebih tinggi dari Ubah Username) dan
    // grid memaksa tiap baris setinggi kartu tertingginya, menyisakan lubang
    // kosong besar di bawah kartu pendek. Dengan columns, kartu mengalir
    // mengisi kolom terpendek berikutnya jadi tidak ada ruang menganggur.
    // gap-6 di sini cuma jarak ANTAR kolom; jarak vertikal antar kartu
    // datang dari mb-6 di pembungkus tiap kartu.
    <div className="columns-1 gap-6 lg:columns-2 xl:columns-3">
      <div className="mb-6 break-inside-avoid">
        <Card>
          <CardHeader>
            <CardTitle>Foto Profil</CardTitle>
            <CardDescription>
              Foto ini cuma tampilan akun Anda (mis. di pojok kanan atas) TIDAK
              menggantikan foto resmi di Data Pegawai.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <AccountAvatarUpload currentUrl={currentAvatarUrl} />
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
      </div>

      <div className="mb-6 break-inside-avoid">
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
      </div>

      <div className="mb-6 break-inside-avoid">
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

      {Children.toArray(extraCards).map((card, i) => (
        <div key={i} className="mb-6 break-inside-avoid">
          {card}
        </div>
      ))}
    </div>
  );
}
