-- FocusInsight OA System - Demo CC Recipient Seed
-- TEST/DEMO ONLY.
-- Run AFTER the database/p1_*_workflow.sql files so the *_cc_recipients tables exist.

USE `portal_oa`;
START TRANSACTION;

INSERT IGNORE INTO `leave_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `travel_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `overtime_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `disbursement_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `loan_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `probation_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `resignation_cc_recipients` (`user_id`) VALUES ('DEMO_HR');
INSERT IGNORE INTO `salary_adjustment_cc_recipients` (`user_id`) VALUES ('DEMO_HR');

COMMIT;
