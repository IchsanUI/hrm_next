-- AlterTable
ALTER TABLE `employees` ADD COLUMN `pinAttendance` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `attendance_devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `loginUser` VARCHAR(191) NOT NULL,
    `loginPass` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_devices_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userPin` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `location` VARCHAR(191) NOT NULL DEFAULT 'Pusat',
    `logTime` DATETIME(3) NOT NULL,
    `verifyType` VARCHAR(191) NOT NULL DEFAULT 'Fingerprint',
    `logType` VARCHAR(191) NOT NULL DEFAULT 'Check-In',
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_logs_logTime_idx`(`logTime`),
    UNIQUE INDEX `attendance_logs_userPin_location_logTime_key`(`userPin`, `location`, `logTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `pollSeconds` INTEGER NOT NULL DEFAULT 10,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `employees_pinAttendance_key` ON `employees`(`pinAttendance`);

