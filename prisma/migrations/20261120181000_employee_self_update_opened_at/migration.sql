-- Waktu izin update mandiri dibuka (ringkasan perubahan untuk HR).
ALTER TABLE `employees` ADD COLUMN `selfUpdateOpenedAt` DATETIME(3) NULL;

UPDATE `employees` SET `selfUpdateOpenedAt` = CURRENT_TIMESTAMP(3) WHERE `allowSelfUpdate` = true;
