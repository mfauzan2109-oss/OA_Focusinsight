-- Migration: fix the live probation_confirmations table so HR can actually
-- submit hr/probation-confirmation-form.html.
--
-- Two separate problems, found by comparing the real table (via DESCRIBE) to
-- what the route/form expect - the sql/probation_confirmations.sql file in
-- this repo does not reflect the live table (it looks like it was written
-- for a planned redesign - assessment_job_knowledge, overall_recommendation,
-- performance_summary, etc. - that was never actually migrated in). Worth a
-- separate look at some point, but out of scope for this fix.
--
-- 1) reason_remarks / supporting_document may already exist on your table -
--    if step 1 errors with "Duplicate column name", just skip to step 2.
-- 2) overall_performance / work_performance / attendance_punctuality /
--    work_attitude_teamwork / recommendation are still NOT NULL with no
--    default, left over from the old form design where HR filled these in
--    directly. The current form design has the Manager fill these in later
--    (via probation-confirmation-detail.html), so HR's initial submission
--    correctly leaves them blank - which fails unless we make them nullable.
--
-- Run this once against the portal_oa database (skip any ADD COLUMN that
-- errors with "Duplicate column name" - it just means that part's already
-- been applied):

ALTER TABLE `probation_confirmations`
  ADD COLUMN `reason_remarks` TEXT COLLATE utf8mb4_general_ci NULL AFTER `probation_end_date`,
  ADD COLUMN `supporting_document` VARCHAR(255) COLLATE utf8mb4_general_ci NULL AFTER `reason_remarks`;

ALTER TABLE `probation_confirmations`
  MODIFY COLUMN `overall_performance` varchar(50) COLLATE utf8mb4_general_ci NULL,
  MODIFY COLUMN `work_performance` varchar(50) COLLATE utf8mb4_general_ci NULL,
  MODIFY COLUMN `attendance_punctuality` varchar(50) COLLATE utf8mb4_general_ci NULL,
  MODIFY COLUMN `work_attitude_teamwork` varchar(50) COLLATE utf8mb4_general_ci NULL,
  MODIFY COLUMN `recommendation` varchar(50) COLLATE utf8mb4_general_ci NULL;
