-- Migration: adds the Manager/HOD probation assessment columns to probation_confirmations.
-- Needed by POST /api/probation-confirmation/:id/assessment (probation-confirmation-detail.html).
--


ALTER TABLE `probation_confirmations`
  ADD COLUMN `assessment_job_knowledge` TINYINT NULL,
  ADD COLUMN `assessment_quality_of_work` TINYINT NULL,
  ADD COLUMN `assessment_work_productivity` TINYINT NULL,
  ADD COLUMN `assessment_communication_skills` TINYINT NULL,
  ADD COLUMN `assessment_teamwork_collaboration` TINYINT NULL,
  ADD COLUMN `assessment_problem_solving_initiative` TINYINT NULL,
  ADD COLUMN `assessment_attendance_punctuality` TINYINT NULL,
  ADD COLUMN `assessment_adaptability_learning` TINYINT NULL,
  ADD COLUMN `assessment_responsibility_attitude` TINYINT NULL,
  ADD COLUMN `assessment_compliance_policies` TINYINT NULL,
  ADD COLUMN `total_points` INT NULL,
  ADD COLUMN `passing_points` INT NULL,
  ADD COLUMN `overall_recommendation` VARCHAR(30) NULL,
  ADD COLUMN `proposed_confirmation_date` DATE NULL,
  ADD COLUMN `extended_probation_period` VARCHAR(100) NULL,
  ADD COLUMN `performance_summary` TEXT NULL,
  ADD COLUMN `assessed_by` VARCHAR(20) NULL,
  ADD COLUMN `assessed_at` DATETIME NULL;