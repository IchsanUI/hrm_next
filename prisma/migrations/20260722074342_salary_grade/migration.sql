-- CreateTable
CREATE TABLE `salary_grades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `subGrade` VARCHAR(191) NOT NULL,
    `minSalary` DOUBLE NULL,
    `maxSalary` DOUBLE NULL,
    `maxStep` INTEGER NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_grades_code_subGrade_key`(`code`, `subGrade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
