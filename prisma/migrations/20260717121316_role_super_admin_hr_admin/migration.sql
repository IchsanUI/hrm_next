-- Expand enum first so both old and new values are valid during the transition
ALTER TABLE `roles` MODIFY COLUMN `name` ENUM('ADMIN', 'SUPER_ADMIN', 'HR_ADMIN', 'EMPLOYEE') NOT NULL;

-- Migrate existing ADMIN role row to SUPER_ADMIN
UPDATE `roles` SET `name` = 'SUPER_ADMIN' WHERE `name` = 'ADMIN';

-- Ensure the HR_ADMIN role row exists
INSERT INTO `roles` (`name`, `createdAt`)
SELECT 'HR_ADMIN', NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'HR_ADMIN');

-- Narrow enum to the final set now that no row uses the old ADMIN value
ALTER TABLE `roles` MODIFY COLUMN `name` ENUM('SUPER_ADMIN', 'HR_ADMIN', 'EMPLOYEE') NOT NULL;
