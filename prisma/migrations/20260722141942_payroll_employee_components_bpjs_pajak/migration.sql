-- AlterTable
ALTER TABLE `employees` ADD COLUMN `npwp` VARCHAR(191) NULL,
    ADD COLUMN `ptkpStatus` ENUM('TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3') NULL;

-- CreateTable
CREATE TABLE `employee_salary_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `salaryComponentId` INTEGER NOT NULL,
    `amount` DOUBLE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_salary_components_employeeId_salaryComponentId_key`(`employeeId`, `salaryComponentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bpjs_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `kesehatanEmployeePercent` DOUBLE NOT NULL DEFAULT 1,
    `kesehatanCompanyPercent` DOUBLE NOT NULL DEFAULT 4,
    `kesehatanSalaryCap` DOUBLE NULL,
    `jhtEmployeePercent` DOUBLE NOT NULL DEFAULT 2,
    `jhtCompanyPercent` DOUBLE NOT NULL DEFAULT 3.7,
    `jpEmployeePercent` DOUBLE NOT NULL DEFAULT 1,
    `jpCompanyPercent` DOUBLE NOT NULL DEFAULT 2,
    `jpSalaryCap` DOUBLE NULL,
    `jkkCompanyPercent` DOUBLE NOT NULL DEFAULT 0.24,
    `jkmCompanyPercent` DOUBLE NOT NULL DEFAULT 0.3,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ptkp_rates` (
    `status` ENUM('TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3') NOT NULL,
    `annualAmount` DOUBLE NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tax_brackets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order` INTEGER NOT NULL DEFAULT 0,
    `minIncome` DOUBLE NOT NULL,
    `maxIncome` DOUBLE NULL,
    `ratePercent` DOUBLE NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_salary_components` ADD CONSTRAINT `employee_salary_components_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_components` ADD CONSTRAINT `employee_salary_components_salaryComponentId_fkey` FOREIGN KEY (`salaryComponentId`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
