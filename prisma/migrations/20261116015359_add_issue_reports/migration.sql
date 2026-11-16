-- CreateTable
CREATE TABLE `issue_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `category` ENUM('APLIKASI', 'ABSENSI', 'PAYROLL', 'AKUN', 'LAINNYA') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('BARU', 'DIPROSES', 'SELESAI', 'DITOLAK') NOT NULL DEFAULT 'BARU',
    `adminNote` TEXT NULL,
    `handledById` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `issue_reports_publicId_key`(`publicId`),
    INDEX `issue_reports_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `issue_reports_employeeId_createdAt_idx`(`employeeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `issue_reports` ADD CONSTRAINT `issue_reports_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_reports` ADD CONSTRAINT `issue_reports_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
