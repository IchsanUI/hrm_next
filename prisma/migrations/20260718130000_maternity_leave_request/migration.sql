-- CreateTable
CREATE TABLE `maternity_leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `type` ENUM('BERSALIN', 'GUGUR_KANDUNGAN') NOT NULL,
    `referenceDate` DATE NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NULL,
    `substituteEmployeeId` INTEGER NULL,
    `substituteEmployeeName` VARCHAR(191) NULL,
    `supportingDocumentUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISI') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approverId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maternity_leave_requests_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maternity_leave_approval_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverType` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI', 'PEGAWAI_TERTENTU') NOT NULL,
    `approverId` INTEGER NULL,
    `status` ENUM('WAITING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISED', 'SKIPPED') NOT NULL DEFAULT 'WAITING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maternity_leave_approval_steps_requestId_order_idx`(`requestId`, `order`),
    INDEX `maternity_leave_approval_steps_approverId_status_idx`(`approverId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maternity_leave_requests` ADD CONSTRAINT `maternity_leave_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maternity_leave_requests` ADD CONSTRAINT `maternity_leave_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maternity_leave_requests` ADD CONSTRAINT `maternity_leave_requests_substituteEmployeeId_fkey` FOREIGN KEY (`substituteEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maternity_leave_approval_steps` ADD CONSTRAINT `maternity_leave_approval_steps_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `maternity_leave_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maternity_leave_approval_steps` ADD CONSTRAINT `maternity_leave_approval_steps_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

