-- P1 workflow tables for Overtime.
-- Production CC recipients are intentionally not seeded here.

CREATE TABLE IF NOT EXISTS overtime_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    overtime_id INT NOT NULL,
    step_order INT NOT NULL,
    step_label VARCHAR(100) NOT NULL,
    approver_role VARCHAR(100) NOT NULL,
    status ENUM(
        'Waiting',
        'Pending',
        'Approved',
        'Rejected',
        'Cancelled'
    ) NOT NULL DEFAULT 'Waiting',
    acted_by VARCHAR(50) NULL,
    acted_at DATETIME NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_overtime_step (
        overtime_id,
        step_order
    ),

    CONSTRAINT fk_overtime_approval_request
        FOREIGN KEY (overtime_id)
        REFERENCES overtime(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS overtime_cc_recipients (
    user_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
);


CREATE TABLE IF NOT EXISTS overtime_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    overtime_id INT NOT NULL,
    recipient_id VARCHAR(50) NOT NULL,
    outcome ENUM('Approved','Rejected') NOT NULL,
    kind ENUM('outcome','cc') NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_overtime_notification (
        overtime_id,
        recipient_id,
        kind
    ),

    KEY idx_overtime_notification_request (
        overtime_id
    ),

    KEY idx_overtime_notification_recipient (
        recipient_id
    )
);