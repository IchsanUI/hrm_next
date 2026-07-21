-- CreateTable
CREATE TABLE `izin_type_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `submissionCutoffTime` VARCHAR(5) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `izin_type_settings_leaveType_key`(`leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
