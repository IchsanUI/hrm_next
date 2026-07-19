-- CreateTable
CREATE TABLE `cuti_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `substituteEmployeeId` INTEGER NULL,
    `substituteEmployeeName` VARCHAR(191) NULL,
    `supportingDocumentUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISI') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `approverId` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cuti_requests_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cuti_approval_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverType` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI', 'PEGAWAI_TERTENTU') NOT NULL,
    `approverId` INTEGER NULL,
    `status` ENUM('WAITING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'REVISED', 'SKIPPED') NOT NULL DEFAULT 'WAITING',
    `notes` TEXT NULL,
    `actedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cuti_approval_steps_requestId_order_idx`(`requestId`, `order`),
    INDEX `cuti_approval_steps_approverId_status_idx`(`approverId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_leave_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `quota` INTEGER NOT NULL DEFAULT 12,
    `adjustment` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employee_leave_balances_employeeId_year_key`(`employeeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cuti_requests` ADD CONSTRAINT `cuti_requests_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuti_requests` ADD CONSTRAINT `cuti_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuti_requests` ADD CONSTRAINT `cuti_requests_substituteEmployeeId_fkey` FOREIGN KEY (`substituteEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuti_approval_steps` ADD CONSTRAINT `cuti_approval_steps_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `cuti_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuti_approval_steps` ADD CONSTRAINT `cuti_approval_steps_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leave_balances` ADD CONSTRAINT `employee_leave_balances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

