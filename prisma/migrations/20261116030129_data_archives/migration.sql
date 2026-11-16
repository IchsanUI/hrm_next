-- CreateTable
CREATE TABLE `data_archives` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `cutoff` DATETIME(3) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` TEXT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `createdByUsername` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fileDeletedAt` DATETIME(3) NULL,
    `lastRestoredAt` DATETIME(3) NULL,
    `lastRestoredRows` INTEGER NULL,

    UNIQUE INDEX `data_archives_publicId_key`(`publicId`),
    INDEX `data_archives_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
