-- Demo leave balances for OA System testing
-- Safe to run more than once because leave_balances has
-- UNIQUE(employee_id, leave_type, year)

INSERT INTO leave_balances
(employee_id, leave_type, year, entitlement, carried_forward, carried_forward_expires)
VALUES
('DEMO_EMP_SW', 'Annual Leave', 2026, 12.0, 0.0, NULL),
('DEMO_EMP_SW', 'Sick Leave', 2026, 14.0, 0.0, NULL),
('DEMO_EMP_SW', 'Hospitalization', 2026, 60.0, 0.0, NULL),
('DEMO_EMP_SW', 'Maternity', 2026, 98.0, 0.0, NULL),
('DEMO_EMP_SW', 'Paternity', 2026, 7.0, 0.0, NULL)
ON DUPLICATE KEY UPDATE
    entitlement = VALUES(entitlement),
    carried_forward = VALUES(carried_forward),
    carried_forward_expires = VALUES(carried_forward_expires);