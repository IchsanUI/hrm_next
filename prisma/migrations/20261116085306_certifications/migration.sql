-- CreateTable
CREATE TABLE `certification_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `kind` ENUM('SERTIFIKASI', 'PELATIHAN') NOT NULL,
    `issuer` VARCHAR(191) NULL,
    `validityMonths` INTEGER NULL,
    `reminderDays` INTEGER NOT NULL DEFAULT 90,
    `description` TEXT NULL,
    `requiredForAll` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `certification_types_publicId_key`(`publicId`),
    UNIQUE INDEX `certification_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certification_type_positions` (
    `certificationTypeId` INTEGER NOT NULL,
    `positionId` INTEGER NOT NULL,

    PRIMARY KEY (`certificationTypeId`, `positionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_certifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `certificationTypeId` INTEGER NOT NULL,
    `certificateNumber` VARCHAR(120) NULL,
    `issuer` VARCHAR(191) NULL,
    `issuedDate` DATE NOT NULL,
    `expiryDate` DATE NULL,
    `storedFileName` VARCHAR(191) NULL,
    `originalFileName` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `lastReminderStage` INTEGER NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_certifications_publicId_key`(`publicId`),
    INDEX `employee_certifications_employeeId_idx`(`employeeId`),
    INDEX `employee_certifications_certificationTypeId_expiryDate_idx`(`certificationTypeId`, `expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `certification_type_positions` ADD CONSTRAINT `certification_type_positions_certificationTypeId_fkey` FOREIGN KEY (`certificationTypeId`) REFERENCES `certification_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certification_type_positions` ADD CONSTRAINT `certification_type_positions_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `positions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_certifications` ADD CONSTRAINT `employee_certifications_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_certifications` ADD CONSTRAINT `employee_certifications_certificationTypeId_fkey` FOREIGN KEY (`certificationTypeId`) REFERENCES `certification_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
