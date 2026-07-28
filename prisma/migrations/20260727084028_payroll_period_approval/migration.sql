-- AlterTable
ALTER TABLE `payroll_periods` ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `submittedForApprovalAt` DATETIME(3) NULL,
    ADD COLUMN `submittedForApprovalBy` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'LOCKED') NOT NULL DEFAULT 'DRAFT';
