-- Migration: add columns needed by hr/probation-confirmation-form.html and
-- routes/request.routes.js (/api/submit-probation-confirmation) that were
-- missing from the original probation_confirmations table.
--
-- Run this once against the portal_oa database:
--   mysql -u <user> -p portal_oa < sql/probation_confirmations_migration.sql

ALTER TABLE `probation_confirmations`
  ADD COLUMN `reason_remarks` TEXT COLLATE utf8mb4_general_ci NULL AFTER `probation_end_date`,
  ADD COLUMN `supporting_document` VARCHAR(255) COLLATE utf8mb4_general_ci NULL AFTER `reason_remarks`;
