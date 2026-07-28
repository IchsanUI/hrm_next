-- AlterTable
ALTER TABLE `bpjs_settings` MODIFY `pph21Method` ENUM('GROSS', 'GROSS_UP', 'NET', 'TER') NOT NULL DEFAULT 'GROSS';

-- CreateTable
CREATE TABLE `ter_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category` ENUM('A', 'B', 'C') NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `minIncome` DOUBLE NOT NULL,
    `maxIncome` DOUBLE NULL,
    `ratePercent` DOUBLE NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
