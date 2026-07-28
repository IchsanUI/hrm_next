-- AlterTable
ALTER TABLE `bpjs_settings` ADD COLUMN `pph21Method` ENUM('GROSS', 'GROSS_UP', 'NET') NOT NULL DEFAULT 'GROSS';
