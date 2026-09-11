-- CreateTable
CREATE TABLE `employee_document_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `watermarkEnabled` BOOLEAN NOT NULL DEFAULT true,
    `watermarkText` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
