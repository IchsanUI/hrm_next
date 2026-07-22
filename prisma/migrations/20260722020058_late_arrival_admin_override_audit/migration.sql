-- AlterTable
ALTER TABLE `late_arrival_requests` ADD COLUMN `arrivalConfirmedByAdmin` VARCHAR(191) NULL,
    ADD COLUMN `arrivalConfirmedByAdminAt` DATETIME(3) NULL;
