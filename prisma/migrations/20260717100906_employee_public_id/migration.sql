-- Add publicId as nullable first (existing rows can't get a Prisma-level default)
ALTER TABLE `employees` ADD COLUMN `publicId` VARCHAR(191) NULL;

-- Backfill existing rows with a unique value
UPDATE `employees` SET `publicId` = UUID() WHERE `publicId` IS NULL;

-- Enforce NOT NULL + uniqueness now that every row has a value
ALTER TABLE `employees` MODIFY COLUMN `publicId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `employees_publicId_key` ON `employees`(`publicId`);
