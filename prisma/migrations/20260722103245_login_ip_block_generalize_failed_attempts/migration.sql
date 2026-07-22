-- Rename column (not drop+add) to preserve existing data — broadening the
-- counter's meaning from "unknown username attempts only" to "any failed
-- login attempt from this IP" (see model comment in schema.prisma).
ALTER TABLE `login_ip_blocks` RENAME COLUMN `unknownAttemptCount` TO `failedAttemptCount`;
