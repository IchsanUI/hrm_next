-- CreateTable
CREATE TABLE `salary_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('PENDAPATAN_TETAP', 'PENDAPATAN_TIDAK_TETAP', 'POTONGAN', 'PINJAMAN') NOT NULL,
    `calculationType` ENUM('NOMINAL_TETAP', 'PERSENTASE', 'KEHADIRAN', 'MANUAL_PERIODE') NOT NULL,
    `percentageValue` DOUBLE NULL,
    `baseComponentId` INTEGER NULL,
    `includedInBruto` BOOLEAN NOT NULL DEFAULT true,
    `isTaxable` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `salary_components` ADD CONSTRAINT `salary_components_baseComponentId_fkey` FOREIGN KEY (`baseComponentId`) REFERENCES `salary_components`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
