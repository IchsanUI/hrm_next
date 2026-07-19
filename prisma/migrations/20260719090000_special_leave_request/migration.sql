-- AlterTable
ALTER TABLE `employees` ADD COLUMN `allowSpecialLeaveExceptionHaji` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `allowSpecialLeaveExceptionUmroh` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `special_leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('HAJI', 'UMROH') NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NULL,
    `isException` BOOLEAN NOT NULL DEFAULT false,
    `substituteEmployeeId` INTEGER NULL,
    `substituteEmployeeName` VARCHAR(191) NULL,
    `supportingDocumentUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISI') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approverId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `special_leave_requests_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `special_leave_approval_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverType` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI', 'PEGAWAI_TERTENTU') NOT NULL,
    `approverId` INTEGER NULL,
    `status` ENUM('WAITING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISED', 'SKIPPED') NOT NULL DEFAULT 'WAITING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `special_leave_approval_steps_requestId_order_idx`(`requestId`, `order`),
    INDEX `special_leave_approval_steps_approverId_status_idx`(`approverId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `special_leave_requests` ADD CONSTRAINT `special_leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_leave_requests` ADD CONSTRAINT `special_leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_leave_requests` ADD CONSTRAINT `special_leave_requests_substituteEmployeeId_fkey` FOREIGN KEY (`substituteEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_leave_approval_steps` ADD CONSTRAINT `special_leave_approval_steps_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `special_leave_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_leave_approval_steps` ADD CONSTRAINT `special_leave_approval_steps_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

