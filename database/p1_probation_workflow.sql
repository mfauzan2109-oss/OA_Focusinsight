START TRANSACTION;

CREATE TABLE IF NOT EXISTS probation_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    probation_id INT NOT NULL,
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
    UNIQUE KEY request_step (probation_id, step_order),

    CONSTRAINT probation_steps_request
        FOREIGN KEY (probation_id)
        REFERENCES probation_confirmations(id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS probation_cc_recipients (
    user_id VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;


CREATE TABLE IF NOT EXISTS probation_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    probation_id INT NOT NULL,
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

    UNIQUE KEY uq_probation_notification (
        probation_id,
        recipient_id,
        kind
    ),

    KEY recipient_inbox (
        recipient_id,
        id
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;

-- CC recipients intentionally not seeded here.
-- Configure real Relevant HR / Admin / IT user IDs separately.

COMMIT;