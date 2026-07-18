-- AlterTable
ALTER TABLE `approval_flow_steps` ADD COLUMN `approverEmployeeId` INTEGER NULL,
    MODIFY `approverType` ENUM('ATASAN_LANGSUNG', 'KEPALA_DEPARTEMEN', 'DIREKSI', 'HR', 'PEGAWAI_PENGGANTI', 'PEGAWAI_TERTENTU') NOT NULL;

-- AddForeignKey
ALTER TABLE `approval_flow_steps` ADD CONSTRAINT `approval_flow_steps_approverEmployeeId_fkey` FOREIGN KEY (`approverEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
