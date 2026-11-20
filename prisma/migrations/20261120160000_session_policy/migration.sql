-- Durasi logout otomatis (idle) yang bisa diatur SUPER_ADMIN.
CREATE TABLE `session_policy` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `idleMinutes` INTEGER NOT NULL DEFAULT 15,
  `warningSeconds` INTEGER NOT NULL DEFAULT 60,
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedByUserId` INTEGER NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `session_policy` (`id`, `idleMinutes`, `warningSeconds`, `updatedAt`)
VALUES (1, 15, 60, CURRENT_TIMESTAMP(3));
