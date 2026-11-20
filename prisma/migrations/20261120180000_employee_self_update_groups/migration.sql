-- Grup data yang boleh diperbarui pegawai sendiri (lib/self-update-fields.ts).
ALTER TABLE `employees` ADD COLUMN `selfUpdateGroups` JSON NOT NULL DEFAULT (JSON_ARRAY());

-- Pegawai yang izinnya sedang aktif tetap mendapat cakupan versi lama
-- (kontak, alamat, media sosial).
UPDATE `employees` SET `selfUpdateGroups` = JSON_ARRAY('kontak', 'alamat', 'sosmed') WHERE `allowSelfUpdate` = true;
