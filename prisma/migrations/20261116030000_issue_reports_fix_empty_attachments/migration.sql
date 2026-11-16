-- Baris yang sudah ada saat kolom JSON `attachmentUrls` ditambahkan terisi
-- string kosong (bukan JSON valid) di MariaDB — normalkan jadi array kosong.
UPDATE `issue_reports` SET `attachmentUrls` = '[]' WHERE `attachmentUrls` IS NULL OR `attachmentUrls` = '';
