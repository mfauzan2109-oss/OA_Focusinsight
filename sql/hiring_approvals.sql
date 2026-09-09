CREATE TABLE IF NOT EXISTS `hiring_approvals` (
    `id` INT NOT NULL AUTO_INCREMENT,

    `requested_by` VARCHAR(20) DEFAULT NULL,
    `request_date` DATE DEFAULT NULL,
    `department` VARCHAR(100) DEFAULT NULL,

    `employee_name` VARCHAR(100) NOT NULL,
    `employee_id` VARCHAR(50) NOT NULL,
    `hiring_type` VARCHAR(50) NOT NULL,
    `employee_replaced_id` VARCHAR(50) DEFAULT NULL,

    `number_of_vacancy` INT NOT NULL DEFAULT 1,
    `employment_type` VARCHAR(50) DEFAULT NULL,
    `employment_period` VARCHAR(50) DEFAULT NULL,
    `work_location` VARCHAR(150) DEFAULT NULL,
    `required_start_date` DATE DEFAULT NULL,

    `reason_for_hiring` TEXT,
    `job_description` TEXT,
    `key_responsibilities` TEXT,

    `minimum_qualification` VARCHAR(255) DEFAULT NULL,
    `required_skills` TEXT,
    `required_experience` TEXT,

    `salary_range` VARCHAR(100) DEFAULT NULL,
    `budget_cost_center` VARCHAR(100) DEFAULT NULL,
    `hiring_priority` VARCHAR(20) DEFAULT NULL,

    `supporting_document` VARCHAR(255) DEFAULT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;