-- Nomor tiket Laporan Kendala (LK-<YYMM>-<id 4 digit>). Ditambah nullable dulu
-- supaya laporan yang sudah ada bisa di-backfill sebelum NOT NULL + UNIQUE.
ALTER TABLE `issue_reports` ADD COLUMN `ticketNumber` VARCHAR(191) NULL;

UPDATE `issue_reports`
SET `ticketNumber` = CONCAT('LK-', DATE_FORMAT(`createdAt`, '%y%m'), '-', LPAD(`id`, 4, '0'));

ALTER TABLE `issue_reports` MODIFY `ticketNumber` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `issue_reports_ticketNumber_key` ON `issue_reports`(`ticketNumber`);
