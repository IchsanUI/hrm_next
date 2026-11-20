ALTER TABLE `users`
  ADD COLUMN `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `password_history` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `password` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `password_history_userId_createdAt_idx` (`userId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `password_history_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `password_policy` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `intervalDays` INTEGER NULL,
  `warningDays` INTEGER NOT NULL DEFAULT 14,
  `effectiveAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedByUserId` INTEGER NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `password_policy` (`id`, `intervalDays`, `warningDays`, `effectiveAt`, `updatedAt`)
VALUES (1, NULL, 14, NULL, CURRENT_TIMESTAMP(3));
