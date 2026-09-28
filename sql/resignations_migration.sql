-- Migration: add requested_by_name and requester_position to resignations.
--
-- routes/p1-request.routes.js's POST /api/submit-resignation has always
-- inserted into these two columns, and routes/resignation-approval.routes.js's
-- approval-queue query has always selected requested_by_name - but neither
-- column ever existed in sql/resignations.sql. Found via the "Unknown column
-- 'r.requested_by_name'" error flooding the resignation-approval endpoint
-- (2026-09-23). Until this runs, resignation submission itself is also
-- broken (same missing-column error, just on the INSERT instead of SELECT).
--
-- Run once against the fis_os_system database. Skip any ADD COLUMN that errors
-- with "Duplicate column name" - it just means that part's already applied.

ALTER TABLE `resignations`
  ADD COLUMN `requested_by_name` VARCHAR(255) COLLATE utf8mb4_general_ci NULL AFTER `requested_by`,
  ADD COLUMN `requester_position` VARCHAR(100) COLLATE utf8mb4_general_ci NULL AFTER `requested_by_name`;
