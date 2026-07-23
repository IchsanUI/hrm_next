-- Tambah kolom baru dulu (nullable, aman).
ALTER TABLE `employees` ADD COLUMN `salaryGradeId` INTEGER NULL;
ALTER TABLE `employees` ADD COLUMN `salaryGradeStep` INTEGER NULL;

-- Migrasi data lama: field `rank` (teks bebas, format "Golongan-Ruang/Step"
-- mis. "C-3/12") dipecah ke SalaryGrade + salaryGradeStep sebelum kolomnya
-- dihapus. Cuma 1 baris terpengaruh saat migrasi ini ditulis (employee id
-- 179, rank "C-3/12") — kalau ada rank lain yang tidak cocok pola ini,
-- baris itu dilewati (salaryGradeId tetap NULL, tidak error).
INSERT INTO `salary_grades` (`code`, `subGrade`, `displayOrder`, `isActive`, `createdAt`, `updatedAt`)
SELECT DISTINCT
  SUBSTRING_INDEX(SUBSTRING_INDEX(`rank`, '-', 1), '/', 1) AS code,
  SUBSTRING_INDEX(SUBSTRING_INDEX(`rank`, '-', -1), '/', 1) AS subGrade,
  0, 1, NOW(), NOW()
FROM `employees`
WHERE `rank` IS NOT NULL
  AND `rank` LIKE '%-%/%'
  AND NOT EXISTS (
    SELECT 1 FROM `salary_grades` sg
    WHERE sg.`code` = SUBSTRING_INDEX(SUBSTRING_INDEX(`employees`.`rank`, '-', 1), '/', 1)
      AND sg.`subGrade` = SUBSTRING_INDEX(SUBSTRING_INDEX(`employees`.`rank`, '-', -1), '/', 1)
  );

UPDATE `employees` e
JOIN `salary_grades` sg
  ON sg.`code` = SUBSTRING_INDEX(SUBSTRING_INDEX(e.`rank`, '-', 1), '/', 1)
  AND sg.`subGrade` = SUBSTRING_INDEX(SUBSTRING_INDEX(e.`rank`, '-', -1), '/', 1)
SET
  e.`salaryGradeId` = sg.`id`,
  e.`salaryGradeStep` = CAST(SUBSTRING_INDEX(e.`rank`, '/', -1) AS UNSIGNED)
WHERE e.`rank` IS NOT NULL
  AND e.`rank` LIKE '%-%/%';

-- Baru sekarang aman drop kolom lama.
ALTER TABLE `employees` DROP COLUMN `rank`;

-- Foreign key buat relasi baru (MySQL InnoDB otomatis bikin index dari FK ini).
ALTER TABLE `employees` ADD CONSTRAINT `employees_salaryGradeId_fkey`
  FOREIGN KEY (`salaryGradeId`) REFERENCES `salary_grades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
