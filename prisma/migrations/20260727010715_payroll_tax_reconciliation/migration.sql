-- AlterTable
ALTER TABLE `employees` ADD COLUMN `resignDate` DATE NULL;

-- AlterTable
ALTER TABLE `payslips` ADD COLUMN `isFinalTaxPeriod` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `taxableMonthly` DOUBLE NOT NULL DEFAULT 0;
