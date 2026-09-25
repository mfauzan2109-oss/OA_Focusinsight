# FocusInsight OA Database Setup

Recommended setup order for a fresh local `portal_oa` database.

1. Import `database/base_schema.sql`.
2. Import the standalone feature schemas in `sql/` that are used by the project, including `leave_balances.sql`, `job_transfer_requests.sql`, `job_transfer_approval_steps.sql`, `probation_confirmations.sql`, `resignations.sql`, `salary_adjustments.sql`, and the other active form schemas.
3. Import the active workflow files in `database/`:
   - `p1_leave_travel_workflow.sql`
   - `p1_overtime_workflow.sql`
   - `p1_disbursement_workflow.sql`
   - `p1_loan_workflow.sql`
   - `p1_probation_workflow.sql`
   - `p1_resignation_workflow.sql`
   - `p1_salary_adjustment_workflow.sql`
4. For demo/testing only, import `database/demo_seed.sql`.
5. For demo leave balance data, import `sql/demo_leave_balances.sql`.
6. For demo HR CC notifications, import `database/demo_cc_seed.sql` after the workflow tables exist.

## Notes

- Loan is an active module and its base `loans` table is included in `base_schema.sql`; its approval/CC/notification tables are created by `p1_loan_workflow.sql`.
- Do not import a full development database dump into another developer's database unless you intentionally want its test requests, approval history, and notifications.
- Demo credentials in `demo_seed.sql` are for local testing only.
