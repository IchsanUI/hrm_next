-- AlterTable
ALTER TABLE `library_documents` ADD COLUMN `ocrRequested` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `partNumber` INTEGER NULL,
    ADD COLUMN `partOfId` INTEGER NULL,
    ADD COLUMN `scanPageCount` INTEGER NULL,
    ADD COLUMN `textError` VARCHAR(500) NULL,
    ADD COLUMN `textExtractedAt` DATETIME(3) NULL,
    ADD COLUMN `textStatus` ENUM('MENUNGGU', 'DIPROSES', 'DIJADWALKAN', 'SELESAI', 'SEBAGIAN', 'TANPA_OCR', 'GAGAL') NOT NULL DEFAULT 'MENUNGGU';

-- CreateTable
CREATE TABLE `library_document_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `pageNumber` INTEGER NOT NULL,
    `text` LONGTEXT NOT NULL,
    `source` ENUM('TEXT_LAYER', 'OCR', 'NONE') NOT NULL,
    `confidence` DOUBLE NULL,

    UNIQUE INDEX `library_document_pages_documentId_pageNumber_key`(`documentId`, `pageNumber`),
    FULLTEXT INDEX `library_document_pages_text_idx`(`text`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `library_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `ocrEnabled` BOOLEAN NOT NULL DEFAULT true,
    `ocrDirectMaxPages` INTEGER NOT NULL DEFAULT 20,
    `ocrQueueMaxPages` INTEGER NOT NULL DEFAULT 50,
    `ocrMaxScanPages` INTEGER NOT NULL DEFAULT 300,
    `maxTotalPages` INTEGER NOT NULL DEFAULT 1000,
    `nightStart` VARCHAR(5) NOT NULL DEFAULT '18:00',
    `nightEnd` VARCHAR(5) NOT NULL DEFAULT '06:00',
    `ocrPageTimeoutSec` INTEGER NOT NULL DEFAULT 60,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `library_documents_textStatus_idx` ON `library_documents`(`textStatus`);

-- CreateIndex
CREATE UNIQUE INDEX `library_documents_partOfId_partNumber_key` ON `library_documents`(`partOfId`, `partNumber`);

-- AddForeignKey
ALTER TABLE `library_documents` ADD CONSTRAINT `library_documents_partOfId_fkey` FOREIGN KEY (`partOfId`) REFERENCES `library_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `library_document_pages` ADD CONSTRAINT `library_document_pages_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `library_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

