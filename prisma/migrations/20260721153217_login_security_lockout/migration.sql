-- AlterTable
ALTER TABLE `users` ADD COLUMN `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `login_ip_blocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ip` VARCHAR(191) NOT NULL,
    `unknownAttemptCount` INTEGER NOT NULL DEFAULT 0,
    `blockedUntil` DATETIME(3) NULL,
    `permanentlyBlocked` BOOLEAN NOT NULL DEFAULT false,
    `lastUsername` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `login_ip_blocks_ip_key`(`ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
