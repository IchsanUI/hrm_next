-- CreateTable
CREATE TABLE `vehicles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `plateNumber` VARCHAR(20) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 5,
    `color` VARCHAR(50) NULL,
    `photoUrl` VARCHAR(191) NULL,
    `workLocationId` INTEGER NOT NULL,
    `status` ENUM('TERSEDIA', 'SERVIS', 'NONAKTIF') NOT NULL DEFAULT 'TERSEDIA',
    `notes` TEXT NULL,
    `lastOdometerKm` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicles_publicId_key`(`publicId`),
    UNIQUE INDEX `vehicles_plateNumber_key`(`plateNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle_staff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `role` ENUM('PETUGAS', 'SOPIR') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vehicle_staff_employeeId_role_key`(`employeeId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle_bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `bookingNumber` VARCHAR(20) NOT NULL,
    `vehicleId` INTEGER NOT NULL,
    `requesterId` INTEGER NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `destination` VARCHAR(200) NOT NULL,
    `purpose` TEXT NOT NULL,
    `passengerCount` INTEGER NOT NULL DEFAULT 1,
    `needsDriver` BOOLEAN NOT NULL DEFAULT false,
    `driverId` INTEGER NULL,
    `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN', 'BERJALAN', 'SELESAI') NOT NULL DEFAULT 'MENUNGGU',
    `handledById` INTEGER NULL,
    `handledAt` DATETIME(3) NULL,
    `handlerNote` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `cancelReason` TEXT NULL,
    `departedAt` DATETIME(3) NULL,
    `startKm` INTEGER NULL,
    `returnedAt` DATETIME(3) NULL,
    `endKm` INTEGER NULL,
    `returnNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vehicle_bookings_publicId_key`(`publicId`),
    UNIQUE INDEX `vehicle_bookings_bookingNumber_key`(`bookingNumber`),
    INDEX `vehicle_bookings_vehicleId_startAt_idx`(`vehicleId`, `startAt`),
    INDEX `vehicle_bookings_requesterId_startAt_idx`(`requesterId`, `startAt`),
    INDEX `vehicle_bookings_driverId_startAt_idx`(`driverId`, `startAt`),
    INDEX `vehicle_bookings_status_startAt_idx`(`status`, `startAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_workLocationId_fkey` FOREIGN KEY (`workLocationId`) REFERENCES `work_locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_staff` ADD CONSTRAINT `vehicle_staff_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_bookings` ADD CONSTRAINT `vehicle_bookings_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_bookings` ADD CONSTRAINT `vehicle_bookings_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_bookings` ADD CONSTRAINT `vehicle_bookings_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicle_bookings` ADD CONSTRAINT `vehicle_bookings_handledById_fkey` FOREIGN KEY (`handledById`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
