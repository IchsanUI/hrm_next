-- CreateTable
CREATE TABLE `org_external_nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `organization` VARCHAR(150) NULL,
    `parentExternalId` INTEGER NULL,
    `parentEmployeeId` INTEGER NULL,
    `childEmployeeIds` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `org_external_nodes` ADD CONSTRAINT `org_external_nodes_parentExternalId_fkey` FOREIGN KEY (`parentExternalId`) REFERENCES `org_external_nodes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

