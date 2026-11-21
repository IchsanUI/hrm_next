-- CreateTable
CREATE TABLE `login_wallpapers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `imageUrl` VARCHAR(255) NOT NULL,
    `label` VARCHAR(100) NULL,
    `focusX` INTEGER NOT NULL DEFAULT 50,
    `focusY` INTEGER NOT NULL DEFAULT 50,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `uploadedBy` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_wallpapers_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `slideSeconds` INTEGER NOT NULL DEFAULT 9,
    `taglineWords` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Data awal: gambar & tagline yang sudah dipakai sebelum fitur ini ada,
-- supaya tampilan login tidak berubah sampai Super Admin mengaturnya.
INSERT INTO `login_wallpapers` (`imageUrl`, `label`, `focusX`, `focusY`, `sortOrder`, `isActive`) VALUES
  ('/login-hero.webp', 'Tim Bank Gresik (senja)', 75, 30, 1, true),
  ('/Wallpaper-Pagi.png', 'Ilustrasi pagi', 50, 50, 2, true),
  ('/Wallpaper-Sore.png', 'Ilustrasi sore', 50, 50, 3, true),
  ('/Wallpaper-Malam.png', 'Ilustrasi malam', 50, 50, 4, true);

INSERT INTO `login_settings` (`id`, `slideSeconds`, `taglineWords`, `updatedAt`) VALUES
  (1, 9, JSON_ARRAY('Kepegawaian', 'Absensi', 'Izin', 'Payroll', 'Perpustakaan', 'Klaim Kesehatan'), CURRENT_TIMESTAMP(3));
