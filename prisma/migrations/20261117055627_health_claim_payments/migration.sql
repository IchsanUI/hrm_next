-- CreateTable
CREATE TABLE `health_claim_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `claimId` INTEGER NOT NULL,
    `memoId` INTEGER NOT NULL,
    `method` ENUM('TUNAI', 'TRANSFER') NOT NULL,
    `paidDate` DATE NOT NULL,
    `amount` INTEGER NOT NULL,
    `reference` VARCHAR(150) NULL,
    `bankName` VARCHAR(100) NULL,
    `bankAccountNumber` VARCHAR(50) NULL,
    `bankAccountHolder` VARCHAR(150) NULL,
    `recordedByName` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `health_claim_payments_claimId_key`(`claimId`),
    INDEX `health_claim_payments_memoId_idx`(`memoId`),
    INDEX `health_claim_payments_paidDate_idx`(`paidDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_claim_payment_proofs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(191) NOT NULL,
    `memoId` INTEGER NOT NULL,
    `storedFileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedByName` VARCHAR(150) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `health_claim_payment_proofs_publicId_key`(`publicId`),
    UNIQUE INDEX `health_claim_payment_proofs_storedFileName_key`(`storedFileName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `health_claim_payments` ADD CONSTRAINT `health_claim_payments_claimId_fkey` FOREIGN KEY (`claimId`) REFERENCES `health_claims`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_payments` ADD CONSTRAINT `health_claim_payments_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `health_claim_memos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_claim_payment_proofs` ADD CONSTRAINT `health_claim_payment_proofs_memoId_fkey` FOREIGN KEY (`memoId`) REFERENCES `health_claim_memos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
