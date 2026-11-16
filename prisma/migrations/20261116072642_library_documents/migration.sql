-- CreateTable
CREATE TABLE `library_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NULL,
    `category` ENUM('OJK', 'PERATURAN_PERUSAHAAN', 'SOP', 'SURAT_EDARAN', 'LAINNYA') NOT NULL,
    `description` TEXT NULL,
    `effectiveDate` DATE NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `pageCount` INTEGER NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `library_documents_publicId_key`(`publicId`),
    UNIQUE INDEX `library_documents_storedName_key`(`storedName`),
    INDEX `library_documents_category_isPublished_idx`(`category`, `isPublished`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `library_document_reads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `firstReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readCount` INTEGER NOT NULL DEFAULT 1,

    INDEX `library_document_reads_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `library_document_reads_documentId_employeeId_key`(`documentId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `library_document_reads` ADD CONSTRAINT `library_document_reads_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `library_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `library_document_reads` ADD CONSTRAINT `library_document_reads_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
