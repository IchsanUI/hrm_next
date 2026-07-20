-- CreateTable
CREATE TABLE `overtime_proofs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `overtime_proofs` ADD CONSTRAINT `overtime_proofs_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `overtime_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Pindahkan proofUrl lama (kalau ada) ke tabel baru sebelum kolomnya dihapus,
-- supaya bukti lembur yang sudah ada tidak hilang.
INSERT INTO `overtime_proofs` (`requestId`, `url`)
SELECT `id`, `proofUrl` FROM `overtime_requests` WHERE `proofUrl` IS NOT NULL;

-- AlterTable
ALTER TABLE `overtime_requests` DROP COLUMN `proofUrl`;
