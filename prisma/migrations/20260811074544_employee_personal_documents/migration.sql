-- AlterTable
ALTER TABLE `employee_children` ADD COLUMN `birthCertFilePath` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `kkFilePath` VARCHAR(191) NULL,
    ADD COLUMN `ktpFilePath` VARCHAR(191) NULL,
    ADD COLUMN `maritalDocumentFilePath` VARCHAR(191) NULL,
    ADD COLUMN `npwpFilePath` VARCHAR(191) NULL;
