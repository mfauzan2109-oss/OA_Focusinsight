-- Migration: add employment_period to hiring_approvals.
--
-- routes/p1-request.routes.js has always inserted into an `employment_period`
-- column (required whenever Employment Type is Contract/Intern/Probation),
-- but sql/hiring_approvals.sql never defined it - found while updating the
-- Hiring Approval Form layout (2026-09-23). If your live table doesn't have
-- this column yet, any submission with Employment Type set to Contract,
-- Intern, or Probation would fail with "Unknown column 'employment_period'".
--
-- Run once against the fis_os_system database. Skip if the column already
-- exists (error will say "Duplicate column name").

ALTER TABLE `hiring_approvals`
  ADD COLUMN `employment_period` VARCHAR(50) NULL AFTER `employment_type`;
