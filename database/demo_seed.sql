-- FocusInsight OA System - Demo Seed
-- TEST/DEMO ONLY. Do not use these credentials in production.
-- Run after database/base_schema.sql.
-- Feature-specific workflow tables can be created afterwards using database/p1_*_workflow.sql.

USE `portal_oa`;
START TRANSACTION;

-- Core departments used by the demo accounts.
INSERT INTO `departments`
(`department_name`, `head_of_department`, `date_created`, `description`)
VALUES
('Management', 'Demo VGM', '2024-01-01', 'Executive leadership responsible for overall company direction, strategy, and governance.'),
('Human Resources', 'Demo HR Specialist', '2024-01-01', 'Manages recruitment, employee welfare, payroll support, and HR policies.'),
('Software', 'Demo HOD Software', '2026-08-12', NULL),
('Field Application Engineer', 'Nik Mohammad Faiz', '2026-08-12', NULL),
('Machine Vision', 'fauzan', '2026-08-12', NULL),
('Electrical Engineering', 'Demo HOD Electrical', '2026-08-14', NULL)
ON DUPLICATE KEY UPDATE
  `head_of_department` = VALUES(`head_of_department`),
  `description` = VALUES(`description`);

-- Demo users used for end-to-end approval testing.
INSERT INTO `users`
(`user_id`, `password`, `name`, `position`, `department`, `company_name`, `email`, `employment_type`, `basic_salary`)
VALUES
('DEMO_CEO', 'demo123', 'Demo CEO', 'CEO', 'Management', 'focusinsight', 'aminahman33@gmail.com', 'Full Time', 12000.00),
('DEMO_CHAIR', 'demo123', 'Demo Chairman', 'Chairman', 'Management', 'focusinsight', 'aminahman33@gmail.com', 'Full Time', 0.00),
('DEMO_EMP_EE', 'demo123', 'Demo Employee Electrical', 'Employee', 'Electrical Engineering', 'focusinsight', 'm.fauzan2109@gmail.com', 'Full Time', 3500.00),
('DEMO_EMP_SW', 'demo123', 'Demo Employee Software', 'Employee', 'Software', 'focusinsight', 'izzat329262@gmail.com', 'Full Time', 3500.00),
('DEMO_HOD_EE', 'demo123', 'Demo HOD Electrical', 'Manager', 'Electrical Engineering', 'focusinsight', 'm.fauzan2109@gmail.com', 'Full Time', 7000.00),
('DEMO_HOD_SW', 'demo123', 'Demo HOD Software', 'Manager', 'Software', 'focusinsight', 'Haziqhasbi2000@gmail.com', 'Full Time', 7000.00),
('DEMO_HR', 'demo123', 'Demo HR Specialist', 'HR Specialist', 'Human Resources', 'focusinsight', 'izzat329262@gmail.com', 'Full Time', 5000.00),
('DEMO_PM_EE', 'demo123', 'Demo Project Manager EE', 'Project Manager', 'Electrical Engineering', 'focusinsight', 'm.fauzan2109@gmail.com', 'Full Time', 6500.00),
('DEMO_PM_SW', 'demo123', 'Demo Project Manager Software', 'Project Manager', 'Software', 'focusinsight', 'Haziqhasbi2000@gmail.com', 'Full Time', 6500.00),
('DEMO_VGM', 'demo123', 'Demo VGM', 'VGM', 'Management', 'focusinsight', 'sabrina@focusinsight.com.my', 'Full Time', 9000.00)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `position` = VALUES(`position`),
  `department` = VALUES(`department`),
  `company_name` = VALUES(`company_name`),
  `email` = VALUES(`email`),
  `employment_type` = VALUES(`employment_type`),
  `basic_salary` = VALUES(`basic_salary`);

COMMIT;
