-- CreateTable
CREATE TABLE `payroll_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `cutoffDay` INTEGER NOT NULL DEFAULT 21,
    `paymentDay` INTEGER NOT NULL DEFAULT 25,
    `bankName` VARCHAR(191) NULL,
    `bankAccountNumber` VARCHAR(191) NULL,
    `bankAccountHolder` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
