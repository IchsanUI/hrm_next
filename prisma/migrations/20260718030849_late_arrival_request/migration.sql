-- CreateTable
CREATE TABLE `late_arrival_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `evidenceUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approverId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `arrivalConfirmedAt` DATETIME(3) NULL,
    `arrivalConfirmedVia` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `late_arrival_approval_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverType` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI', 'PEGAWAI_TERTENTU') NOT NULL,
    `approverId` INTEGER NULL,
    `status` ENUM('WAITING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'WAITING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `late_arrival_approval_steps_approverId_status_idx`(`approverId`, `status`),
    UNIQUE INDEX `late_arrival_approval_steps_requestId_order_key`(`requestId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `late_arrival_requests` ADD CONSTRAINT `late_arrival_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `late_arrival_requests` ADD CONSTRAINT `late_arrival_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `late_arrival_approval_steps` ADD CONSTRAINT `late_arrival_approval_steps_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `late_arrival_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `late_arrival_approval_steps` ADD CONSTRAINT `late_arrival_approval_steps_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
