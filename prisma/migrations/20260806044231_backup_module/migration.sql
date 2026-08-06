-- CreateTable
CREATE TABLE `backups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `scope` ENUM('ALL', 'KEPEGAWAIAN', 'ABSENSI', 'PAYROLL', 'IZIN', 'SISTEM') NOT NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `triggeredByUserId` INTEGER NULL,
    `triggeredByUsername` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `filePath` TEXT NULL,
    `fileSizeBytes` INTEGER NULL,
    `tablesTotal` INTEGER NOT NULL DEFAULT 0,
    `tablesDone` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    UNIQUE INDEX `backups_publicId_key`(`publicId`),
    INDEX `backups_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `mysqldumpPath` VARCHAR(191) NULL,
    `retentionDays` INTEGER NOT NULL DEFAULT 30,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `backups` ADD CONSTRAINT `backups_triggeredByUserId_fkey` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
