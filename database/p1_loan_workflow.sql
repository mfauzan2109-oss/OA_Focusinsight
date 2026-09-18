-- P1 workflow tables for Loan.
-- Production CC recipients are intentionally not seeded here.

CREATE TABLE IF NOT EXISTS loan_approval_steps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id INT NOT NULL,
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

    UNIQUE KEY uq_loan_step (
        loan_id,
        step_order
    ),

    CONSTRAINT fk_loan_approval_request
        FOREIGN KEY (loan_id)
        REFERENCES loans(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS loan_cc_recipients (
    user_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id)
);


CREATE TABLE IF NOT EXISTS loan_notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    loan_id INT NOT NULL,
    recipient_id VARCHAR(50) NOT NULL,
    outcome ENUM('Approved','Rejected') NOT NULL,
    kind ENUM('outcome','cc') NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_loan_notification (
        loan_id,
        recipient_id,
        kind
    ),

    KEY idx_loan_notification_request (
        loan_id
    ),

    KEY idx_loan_notification_recipient (
        recipient_id
    )
);