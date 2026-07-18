-- AlterTable
ALTER TABLE `employees` ADD COLUMN `reportsToId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reportsToId_fkey` FOREIGN KEY (`reportsToId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
