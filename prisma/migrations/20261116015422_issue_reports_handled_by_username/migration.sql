/*
  Warnings:

  - You are about to drop the column `handledById` on the `issue_reports` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `issue_reports` DROP FOREIGN KEY `issue_reports_handledById_fkey`;

-- DropIndex
DROP INDEX `issue_reports_handledById_fkey` ON `issue_reports`;

-- AlterTable
ALTER TABLE `issue_reports` DROP COLUMN `handledById`,
    ADD COLUMN `handledBy` VARCHAR(191) NULL;
