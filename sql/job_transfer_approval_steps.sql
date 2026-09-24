CREATE TABLE IF NOT EXISTS job_transfer_approval_steps (
    id INT NOT NULL AUTO_INCREMENT,
    job_transfer_id INT NOT NULL,
    step_order TINYINT UNSIGNED NOT NULL,
    step_label VARCHAR(100) NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    approver_department VARCHAR(100) NULL,
    status ENUM('Waiting', 'Pending', 'Approved', 'Rejected', 'Cancelled')
        NOT NULL DEFAULT 'Waiting',
    acted_by VARCHAR(50) NULL,
    acted_at DATETIME NULL,
    remarks TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_job_transfer_step (job_transfer_id, step_order),
    KEY idx_job_transfer_pending (
        status, approver_role, approver_department
    ),

    CONSTRAINT fk_job_transfer_steps_request
        FOREIGN KEY (job_transfer_id)
        REFERENCES job_transfer_requests(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;