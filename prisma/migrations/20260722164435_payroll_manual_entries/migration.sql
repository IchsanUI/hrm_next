-- CreateTable
CREATE TABLE `payroll_manual_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payrollPeriodId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `salaryComponentId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payroll_manual_entries_payrollPeriodId_employeeId_salaryComp_key`(`payrollPeriodId`, `employeeId`, `salaryComponentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_manual_entries` ADD CONSTRAINT `payroll_manual_entries_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_manual_entries` ADD CONSTRAINT `payroll_manual_entries_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_manual_entries` ADD CONSTRAINT `payroll_manual_entries_salaryComponentId_fkey` FOREIGN KEY (`salaryComponentId`) REFERENCES `salary_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
