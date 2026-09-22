START TRANSACTION;

CREATE TABLE IF NOT EXISTS resignation_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    resignation_id INT NOT NULL,
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
    UNIQUE KEY uq_resignation_step (resignation_id, step_order),

    CONSTRAINT fk_resignation_approval_request
        FOREIGN KEY (resignation_id)
        REFERENCES resignations(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS resignation_cc_recipients (
    user_id VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS resignation_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    resignation_id INT NOT NULL,
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
        resignation_id,
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
WHERE workflow_type = 'resignation';

INSERT INTO workflows (
    workflow_type,
    workflow_name,
    step_order,
    step_label,
    approver_role
)
VALUES
    ('resignation', 'Resignation Request', 1, 'HOD Approval', 'Head of Department'),
    ('resignation', 'Resignation Request', 2, 'VGM Approval', 'VGM'),
    ('resignation', 'Resignation Request', 3, 'CEO Approval', 'CEO'),
    ('resignation', 'Resignation Request', 4, 'Chairman Approval', 'Chairman'),
    ('resignation', 'Resignation Request', 5, 'HR Specialist Approval', 'HR Specialist');

-- CC recipients intentionally not seeded here.
-- Configure real Relevant HR / Admin / IT user IDs separately.

COMMIT;