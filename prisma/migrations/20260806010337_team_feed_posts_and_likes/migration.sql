-- CreateTable
CREATE TABLE `team_feed_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `team_feed_posts_employeeId_createdAt_idx`(`employeeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_feed_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestKind` VARCHAR(32) NOT NULL,
    `requestId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `team_feed_likes_requestKind_requestId_idx`(`requestKind`, `requestId`),
    UNIQUE INDEX `team_feed_likes_requestKind_requestId_employeeId_key`(`requestKind`, `requestId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_feed_comment_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `commentId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `team_feed_comment_likes_commentId_idx`(`commentId`),
    UNIQUE INDEX `team_feed_comment_likes_commentId_employeeId_key`(`commentId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `team_feed_posts` ADD CONSTRAINT `team_feed_posts_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_feed_likes` ADD CONSTRAINT `team_feed_likes_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_feed_comment_likes` ADD CONSTRAINT `team_feed_comment_likes_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `team_feed_comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_feed_comment_likes` ADD CONSTRAINT `team_feed_comment_likes_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
