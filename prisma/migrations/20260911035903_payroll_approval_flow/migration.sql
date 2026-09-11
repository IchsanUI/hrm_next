-- AlterTable
ALTER TABLE `payroll_periods` ADD COLUMN `correctionCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `overrideCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'LOCKED', 'PENDING_UNLOCK_APPROVAL') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `payroll_approval_flow_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stage` ENUM('LOCK', 'UNLOCK') NOT NULL,
    `order` INTEGER NOT NULL,
    `approverEmployeeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payroll_approval_flow_steps_stage_order_key`(`stage`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_approval_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payrollPeriodId` INTEGER NOT NULL,
    `stage` ENUM('LOCK', 'UNLOCK') NOT NULL,
    `round` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverEmployeeId` INTEGER NOT NULL,
    `status` ENUM('WAITING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'WAITING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_approval_steps_approverEmployeeId_status_idx`(`approverEmployeeId`, `status`),
    UNIQUE INDEX `payroll_approval_steps_payrollPeriodId_stage_round_order_key`(`payrollPeriodId`, `stage`, `round`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payroll_approval_flow_steps` ADD CONSTRAINT `payroll_approval_flow_steps_approverEmployeeId_fkey` FOREIGN KEY (`approverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_approval_steps` ADD CONSTRAINT `payroll_approval_steps_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_approval_steps` ADD CONSTRAINT `payroll_approval_steps_approverEmployeeId_fkey` FOREIGN KEY (`approverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
