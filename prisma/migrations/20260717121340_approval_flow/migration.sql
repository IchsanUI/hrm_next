-- CreateTable
CREATE TABLE `approval_flows` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `approval_flows_leaveType_key`(`leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_flow_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `flowId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `approverType` ENUM('ATASAN_LANGSUNG', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI') NOT NULL,
    `unlockAfter` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `approval_flow_steps_flowId_order_key`(`flowId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `approval_flow_steps` ADD CONSTRAINT `approval_flow_steps_flowId_fkey` FOREIGN KEY (`flowId`) REFERENCES `approval_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
