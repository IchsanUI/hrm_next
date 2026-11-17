-- AlterTable
ALTER TABLE `health_claim_settings` ADD COLUMN `memoClosing` TEXT NULL,
    ADD COLUMN `memoFrom` VARCHAR(255) NOT NULL DEFAULT 'Kepala Bagian Personalia, Umum & IT',
    ADD COLUMN `memoLetterNumberFormat` VARCHAR(100) NULL,
    ADD COLUMN `memoOpening` TEXT NULL,
    ADD COLUMN `memoSubject` VARCHAR(255) NOT NULL DEFAULT 'PENGAJUAN BIAYA PENGGANTIAN PENGOBATAN PEGAWAI & KELUARGA',
    ADD COLUMN `memoTo` VARCHAR(255) NOT NULL DEFAULT 'Yth. Direksi Perumda BPR Bank Gresik';

-- CreateTable
CREATE TABLE `health_claim_memo_flow_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order` INTEGER NOT NULL,
    `type` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'PEGAWAI_TERTENTU', 'DISPOSISI_DIREKTUR') NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `approverEmployeeId` INTEGER NULL,
    `canAdjust` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `health_claim_memo_flow_steps_order_key`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_memos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `memoNumber` VARCHAR(30) NOT NULL,
    `letterNumber` VARCHAR(100) NULL,
    `status` ENUM('MENUNGGU_PERSETUJUAN', 'DIKEMBALIKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'DIBAYAR') NOT NULL DEFAULT 'MENUNGGU_PERSETUJUAN',
    `memoDate` DATE NOT NULL,
    `balanceDate` DATE NOT NULL,
    `createdByEmployeeId` INTEGER NOT NULL,
    `toText` VARCHAR(255) NOT NULL,
    `fromText` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `opening` TEXT NOT NULL,
    `closing` TEXT NOT NULL,
    `totalAmount` INTEGER NOT NULL,
    `round` INTEGER NOT NULL DEFAULT 1,
    `forcedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `health_claim_memos_publicId_key`(`publicId`),
    UNIQUE INDEX `health_claim_memos_memoNumber_key`(`memoNumber`),
    INDEX `health_claim_memos_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_memo_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memoId` INTEGER NOT NULL,
    `claimId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `balanceBefore` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `note` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `health_claim_memo_items_memoId_claimId_key`(`memoId`, `claimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_memo_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `memoId` INTEGER NOT NULL,
    `round` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `type` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'PEGAWAI_TERTENTU', 'DISPOSISI_DIREKTUR') NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `approverEmployeeId` INTEGER NULL,
    `canAdjust` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('MENUNGGU', 'AKTIF', 'DISETUJUI', 'DIKEMBALIKAN', 'DITOLAK', 'DILEWATI', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU',
    `decision` ENUM('SETUJU', 'SETUJU_CATATAN', 'TINJAU_ULANG', 'TIDAK_SETUJU') NULL,
    `note` TEXT NULL,
    `actorName` VARCHAR(150) NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_claim_memo_steps_approverEmployeeId_status_idx`(`approverEmployeeId`, `status`),
    UNIQUE INDEX `health_claim_memo_steps_memoId_round_order_key`(`memoId`, `round`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `health_claim_memo_flow_steps` ADD CONSTRAINT `health_claim_memo_flow_steps_approverEmployeeId_fkey` FOREIGN KEY (`approverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_memos` ADD CONSTRAINT `health_claim_memos_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_memo_items` ADD CONSTRAINT `health_claim_memo_items_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `health_claim_memos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_memo_items` ADD CONSTRAINT `health_claim_memo_items_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `health_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_memo_steps` ADD CONSTRAINT `health_claim_memo_steps_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `health_claim_memos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_memo_steps` ADD CONSTRAINT `health_claim_memo_steps_approverEmployeeId_fkey` FOREIGN KEY (`approverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Teks Nota Dinas bawaan, mengikuti contoh surat yang dipakai saat ini.
UPDATE `health_claim_settings`
SET `memoOpening` = 'Berdasarkan Surat Keputusan Direksi No.01 Tahun 2024 Tentang Penggantian Biaya Pengobatan Pegawai. Bersama ini kami Bagian Personalia dan Umum mengajukan biaya tersebut yaitu sebesar {total} ( {terbilang} ). Dengan rincian sebagai berikut :',
    `memoClosing` = 'Anggaran untuk pengajuan ini dibebankan pada post Biaya Tenaga Kerja Lainnya.\nDemikian permohonan kami, atas perhatian dan persetujuannya kami ucapkan terima kasih.'
WHERE `id` = 1;

-- Alur bawaan langkah pertama: atasan pembuat Nota Dinas (mis. Kabag
-- Personalia, Umum & IT). Langkah Disposisi Direktur ditambahkan di
-- Pengaturan karena perlu memilih nama direkturnya.
INSERT INTO `health_claim_memo_flow_steps` (`order`, `type`, `label`, `approverEmployeeId`, `canAdjust`)
VALUES (1, 'ATASAN_LANGSUNG', 'Kabag Personalia, Umum & IT', NULL, true);
