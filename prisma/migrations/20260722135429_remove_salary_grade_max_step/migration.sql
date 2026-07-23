-- Kolom maxStep sudah tergantikan tabel SalaryGradeRate (nominal PASTI per
-- Golongan-Ruang-MKG, lihat SalaryScaleVersion) yang lebih akurat sebagai
-- sumber kebenaran MKG maksimal per golongan-ruang.
ALTER TABLE `salary_grades` DROP COLUMN `maxStep`;
