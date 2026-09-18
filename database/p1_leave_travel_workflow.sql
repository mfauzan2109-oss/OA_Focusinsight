-- P1 workflow tables for Leave and Travel.
-- CC recipients are intentionally NOT seeded here.
-- Configure real recipients separately per environment.

CREATE TABLE IF NOT EXISTS leave_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    leave_id INT NOT NULL,
    step_order INT NOT NULL,
    step_label VARCHAR(100) NOT NULL,
    approver_role VARCHAR(100) NOT NULL,
    status ENUM('Waiting','Pending','Approved','Rejected','Cancelled')
        NOT NULL DEFAULT 'Waiting',
    acted_by VARCHAR(20) NULL,
    acted_at DATETIME NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_leave_step (leave_id, step_order),

    CONSTRAINT fk_leave_approval_request
        FOREIGN KEY (leave_id)
        REFERENCES `leave`(ID)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS leave_cc_recipients (
    user_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS leave_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    leave_id INT NOT NULL,
    recipient_id VARCHAR(20) NOT NULL,
    outcome ENUM('Approved','Rejected') NOT NULL,
    kind ENUM('outcome','cc') NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_leave_notification (
        leave_id,
        recipient_id,
        kind
    ),
    KEY idx_leave_notification_request (leave_id),
    KEY idx_leave_notification_recipient (recipient_id)
);

CREATE TABLE IF NOT EXISTS travel_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    travel_id INT NOT NULL,
    step_order INT NOT NULL,
    step_label VARCHAR(100) NOT NULL,
    approver_role VARCHAR(100) NOT NULL,
    status ENUM('Waiting','Pending','Approved','Rejected','Cancelled')
        NOT NULL DEFAULT 'Waiting',
    acted_by VARCHAR(20) NULL,
    acted_at DATETIME NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_travel_step (travel_id, step_order),

    CONSTRAINT fk_travel_approval_request
        FOREIGN KEY (travel_id)
        REFERENCES travel(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS travel_cc_recipients (
    user_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS travel_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    travel_id INT NOT NULL,
    recipient_id VARCHAR(20) NOT NULL,
    outcome ENUM('Approved','Rejected') NOT NULL,
    kind ENUM('outcome','cc') NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_travel_notification (
        travel_id,
        recipient_id,
        kind
    ),
    KEY idx_travel_notification_request (travel_id),
    KEY idx_travel_notification_recipient (recipient_id)
);