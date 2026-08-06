-- CreateTable
CREATE TABLE `team_feed_comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestKind` VARCHAR(32) NOT NULL,
    `requestId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `team_feed_comments_requestKind_requestId_createdAt_idx`(`requestKind`, `requestId`, `createdAt`),
    INDEX `team_feed_comments_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `team_feed_comments` ADD CONSTRAINT `team_feed_comments_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
