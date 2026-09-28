-- Multiple date/day-type entries for one Leave application.
-- Example:
--   Entry 1: Mon-Wed, Full Day = 3.0 days
--   Entry 2: Thu, Half Day AM = 0.5 day
-- Total Leave request = 3.5 days

CREATE TABLE IF NOT EXISTS leave_date_entries (
    id INT NOT NULL AUTO_INCREMENT,
    leave_id INT NOT NULL,
    entry_order INT NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    day_type VARCHAR(20) NOT NULL,
    duration DECIMAL(4,1) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_leave_entry (
        leave_id,
        entry_order
    ),

    KEY idx_leave_entry_dates (
        start_date,
        end_date
    ),

    CONSTRAINT fk_leave_date_entry
        FOREIGN KEY (leave_id)
        REFERENCES `leave`(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);