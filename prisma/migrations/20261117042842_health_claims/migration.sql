-- AlterTable
ALTER TABLE `employees` ADD COLUMN `bankAccountHolder` VARCHAR(150) NULL,
    ADD COLUMN `bankAccountNumber` VARCHAR(50) NULL,
    ADD COLUMN `bankName` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `health_claim_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `minEmployeesPerMemo` INTEGER NOT NULL DEFAULT 5,
    `submissionDeadlineDays` INTEGER NULL DEFAULT 30,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_staff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `role` ENUM('PETUGAS', 'ACCOUNTING') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `health_claim_staff_employeeId_role_key`(`employeeId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_eligible_statuses` (
    `employmentStatusId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`employmentStatusId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_plafons` (
    `positionId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`positionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `requiredDocumentLabel` VARCHAR(150) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `health_claim_types_publicId_key`(`publicId`),
    UNIQUE INDEX `health_claim_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claims` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `claimNumber` VARCHAR(30) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `claimTypeId` INTEGER NOT NULL,
    `patientType` ENUM('SELF', 'SPOUSE', 'CHILD') NOT NULL,
    `childId` INTEGER NULL,
    `patientName` VARCHAR(150) NOT NULL,
    `treatmentDate` DATE NOT NULL,
    `dischargeDate` DATE NULL,
    `plafonYear` INTEGER NOT NULL,
    `facility` VARCHAR(200) NOT NULL,
    `diagnosis` TEXT NULL,
    `totalCost` INTEGER NOT NULL,
    `bpjsCovered` INTEGER NOT NULL DEFAULT 0,
    `requestedAmount` INTEGER NOT NULL,
    `approvedAmount` INTEGER NULL,
    `status` ENUM('MENUNGGU_KONFIRMASI', 'REVISI', 'TERKONFIRMASI', 'DALAM_NOTA_DINAS', 'DISETUJUI', 'DIBAYAR', 'DITOLAK', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU_KONFIRMASI',
    `statementAgreed` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `health_claims_publicId_key`(`publicId`),
    UNIQUE INDEX `health_claims_claimNumber_key`(`claimNumber`),
    INDEX `health_claims_employeeId_plafonYear_idx`(`employeeId`, `plafonYear`),
    INDEX `health_claims_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claimId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` INTEGER NOT NULL,
    `approvedAmount` INTEGER NULL,
    `adjustmentNote` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `claimId` INTEGER NOT NULL,
    `kind` ENUM('KUITANSI', 'PENDUKUNG') NOT NULL,
    `storedFileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `health_claim_documents_publicId_key`(`publicId`),
    UNIQUE INDEX `health_claim_documents_storedFileName_key`(`storedFileName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claimId` INTEGER NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `actorName` VARCHAR(150) NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_claim_events_claimId_idx`(`claimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `health_claim_staff` ADD CONSTRAINT `health_claim_staff_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_eligible_statuses` ADD CONSTRAINT `health_claim_eligible_statuses_employmentStatusId_fkey` FOREIGN KEY (`employmentStatusId`) REFERENCES `employment_statuses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_plafons` ADD CONSTRAINT `health_claim_plafons_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `positions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claims` ADD CONSTRAINT `health_claims_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claims` ADD CONSTRAINT `health_claims_claimTypeId_fkey` FOREIGN KEY (`claimTypeId`) REFERENCES `health_claim_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claims` ADD CONSTRAINT `health_claims_childId_fkey` FOREIGN KEY (`childId`) REFERENCES `employee_children`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_items` ADD CONSTRAINT `health_claim_items_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `health_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_documents` ADD CONSTRAINT `health_claim_documents_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `health_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_events` ADD CONSTRAINT `health_claim_events_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `health_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Nilai bawaan (lihat docs/prd-klaim-kesehatan.md). Semua bisa diubah di
-- Pengaturan Klaim Kesehatan.
INSERT INTO `health_claim_settings` (`id`, `minEmployeesPerMemo`, `submissionDeadlineDays`, `updatedAt`)
VALUES (1, 5, 30, CURRENT_TIMESTAMP(3));

-- Status Tetap & Kontrak berhak; status lain (Training/Percobaan/Magang) tidak.
INSERT INTO `health_claim_eligible_statuses` (`employmentStatusId`, `createdAt`)
SELECT `id`, CURRENT_TIMESTAMP(3) FROM `employment_statuses` WHERE LOWER(`name`) IN ('tetap', 'kontrak');

INSERT INTO `health_claim_types` (`publicId`, `name`, `requiredDocumentLabel`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
  ('hctype_rawat_jalan', 'Rawat Jalan', NULL, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_rawat_inap', 'Rawat Inap', 'Surat rujukan / resume medis', true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_obat', 'Obat / Apotek', 'Resep dokter', true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_kacamata', 'Kacamata', 'Resep dokter mata', true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_gigi', 'Perawatan Gigi', NULL, true, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_persalinan', 'Persalinan', 'Surat keterangan lahir', true, 6, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('hctype_lainnya', 'Lainnya', 'Surat keterangan dokter', true, 7, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
