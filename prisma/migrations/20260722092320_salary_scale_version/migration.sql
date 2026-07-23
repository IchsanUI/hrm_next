-- CreateTable
CREATE TABLE `salary_scale_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_grade_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `versionId` INTEGER NOT NULL,
    `salaryGradeId` INTEGER NOT NULL,
    `step` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_grade_rates_versionId_salaryGradeId_step_key`(`versionId`, `salaryGradeId`, `step`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `salary_grade_rates` ADD CONSTRAINT `salary_grade_rates_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `salary_scale_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_grade_rates` ADD CONSTRAINT `salary_grade_rates_salaryGradeId_fkey` FOREIGN KEY (`salaryGradeId`) REFERENCES `salary_grades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
