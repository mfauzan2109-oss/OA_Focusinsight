-- Travel Loan requirement update
-- Existing databases only.
-- Fresh databases already use the updated loans schema in database/base_schema.sql.
--
-- Removed:
--   1. repayment_period
--   2. monthly_salary
--
-- Reason:
--   Repayment period is not used for Travel Loan processing.
--   Monthly/basic salary is not required and should not be exposed in this workflow.

ALTER TABLE loans
    DROP COLUMN repayment_period,
    DROP COLUMN monthly_salary;