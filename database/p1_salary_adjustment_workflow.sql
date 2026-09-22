START TRANSACTION;

CREATE TABLE IF NOT EXISTS salary_adjustment_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    salary_adjustment_id INT NOT NULL,
    step_order INT NOT NULL,
    step_label VARCHAR(100) COLLATE utf8mb4_general_ci NOT NULL,
    approver_role VARCHAR(100) COLLATE utf8mb4_general_ci NOT NULL,
    status ENUM(
        'Waiting',
        'Pending',
        'Approved',
        'Rejected',
        'Cancelled'
    ) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Waiting',
    acted_by VARCHAR(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
    acted_at DATETIME DEFAULT NULL,
    remarks TEXT COLLATE utf8mb4_general_ci,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_salary_adjustment_step (
        salary_adjustment_id,
        step_order
    ),

    CONSTRAINT fk_salary_adjustment_approval_request
        FOREIGN KEY (salary_adjustment_id)
        REFERENCES salary_adjustments(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS salary_adjustment_cc_recipients (
    user_id VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS salary_adjustment_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    salary_adjustment_id INT NOT NULL,
    recipient_id VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
    outcome ENUM(
        'Approved',
        'Rejected'
    ) COLLATE utf8mb4_general_ci NOT NULL,
    kind ENUM(
        'outcome',
        'cc'
    ) COLLATE utf8mb4_general_ci NOT NULL,
    message VARCHAR(255) COLLATE utf8mb4_general_ci NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY one_outcome_per_recipient (
        salary_adjustment_id,
        recipient_id
    ),
    KEY recipient_inbox (
        recipient_id,
        id
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


DELETE FROM workflows
WHERE workflow_type = 'salary_adjustment';

INSERT INTO workflows (
    workflow_type,
    workflow_name,
    step_order,
    step_label,
    approver_role
)
VALUES
    ('salary_adjustment', 'Salary Adjustment Approval', 1, 'VGM Approval', 'VGM'),
    ('salary_adjustment', 'Salary Adjustment Approval', 2, 'CEO Approval', 'CEO'),
    ('salary_adjustment', 'Salary Adjustment Approval', 3, 'Chairman Approval', 'Chairman'),
    ('salary_adjustment', 'Salary Adjustment Approval', 4, 'HR Specialist Approval', 'HR Specialist');

-- CC recipients intentionally not seeded here.
-- Configure real Relevant HR user IDs separately.

COMMIT;