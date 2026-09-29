-- Adds the employee's proposed next position (job title after the salary
-- adjustment) to salary adjustment requests. Manually entered by the
-- requester (HOD) on the Salary Adjustment Request form.

ALTER TABLE `salary_adjustments`
ADD COLUMN `next_position` VARCHAR(100) NULL
AFTER `employment_date`;
