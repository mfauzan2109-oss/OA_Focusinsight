CREATE TABLE IF NOT EXISTS `contract_renewals` (
    `id` int NOT NULL AUTO_INCREMENT,

    `requested_by` varchar(20) DEFAULT NULL,
    `requester_position` varchar(100) DEFAULT NULL,
    `department` varchar(100) DEFAULT NULL,
    `request_date` date DEFAULT NULL,

    `employee_id` varchar(20) NOT NULL,
    `employee_name` varchar(100) NOT NULL,
    `employee_department` varchar(100) DEFAULT NULL,
    `position` varchar(100) DEFAULT NULL,

    `current_start_date` date DEFAULT NULL,
    `current_end_date` date DEFAULT NULL,
    `current_duration` varchar(50) DEFAULT NULL,
    `current_salary` decimal(10,2) DEFAULT '0.00',

    `proposed_start_date` date DEFAULT NULL,
    `proposed_end_date` date DEFAULT NULL,
    `proposed_duration` varchar(50) DEFAULT NULL,
    `proposed_salary` decimal(10,2) DEFAULT '0.00',

    `reason_for_renewal` text,

    `performance_summary` text,
    `attendance_status` varchar(50) DEFAULT NULL,
    `employee_remarks` text,
    `discipline_status` varchar(50) DEFAULT NULL,
    `renewal_recommendation` varchar(50) DEFAULT NULL,
    `supervisor_recommendation` text,

    `supporting_document` varchar(255) DEFAULT NULL,
    `status` varchar(20) NOT NULL DEFAULT 'Pending',
    `last_reminder_sent` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_contract_employee_id` (`employee_id`),
    KEY `idx_contract_status` (`status`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;