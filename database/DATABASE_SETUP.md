# FocusInsight OA Database Setup

This lists every schema file in `sql/` and `database/`, in the order they
need to run. Skip a step only if you already know that table/column exists
— running a `CREATE TABLE IF NOT EXISTS` file again is harmless, but a few
`ALTER TABLE` migrations are **run-once** (marked below) and will error on
a second run with "Duplicate column name". That error just means it's
already applied — move on.

If you hit "Unknown column" or "Table ... doesn't exist" while using the
app, it almost always means one of the files below hasn't been run yet on
that database. Find the matching file in the list and run it.

## 1. Base schema (fresh database only)

1. `database/base_schema.sql` — core tables: `users`, `leave`, `travel`,
   `disbursements`, `loans`, `overtime`, and others the rest of this list
   builds on. Skip this step entirely on a database that already has data.

## 2. Feature tables with no dependencies

Run in any order:

- `sql/announcements.sql`
- `sql/contract_renewals.sql`
- `sql/hiring_approvals.sql`
- `sql/india_visa_applications.sql`
- `sql/job_transfer_requests.sql`
- `sql/leave_balances.sql`
- `sql/manpower_outsourcing_requests.sql`
- `sql/payroll_payment_requests.sql`
- `sql/printing_production_requests.sql`
- `sql/probation_confirmations.sql`
- `sql/recruitment_requests.sql`
- `sql/resignations.sql`
- `sql/salary_adjustments.sql`

## 3. Feature tables that depend on step 2 or step 1

Run after their parent table exists:

- `sql/job_transfer_approval_steps.sql` — needs `job_transfer_requests`
- `sql/manpower_outsourcing_positions.sql` — needs `manpower_outsourcing_requests`
- `sql/recruitment_positions.sql` — needs `recruitment_requests`
- `sql/leave_date_entries.sql` — needs `leave` (from `base_schema.sql`)
- `sql/profile_picture.sql` — adds a column to `users` (from `base_schema.sql`)

## 4. Migrations on existing tables

These `ALTER TABLE` a table created above. Several are **run-once**: a
second run fails with "Duplicate column name", which just means it's
already applied.

- `sql/leave_date_entries_migration.sql` — adds `Date Entries` to `leave`
- `sql/hiring_approvals_migration.sql` — adds `employment_period` to `hiring_approvals` (run-once)
- `sql/probation_assessment_migration.sql` — adds assessment columns to `probation_confirmations` (run-once)
- `sql/resignations_migration.sql` — adds `requested_by_name`, `requester_position` to `resignations`
- `sql/salary_adjustments_next_position.sql` — adds `next_position` to `salary_adjustments`
- `sql/loan_remove_repayment_salary.sql` — **existing databases only.** A fresh database already has the updated `loans` schema from `base_schema.sql`; running this against a fresh database is unnecessary but harmless.

## 5. Workflow tables (approval/CC/notification)

Each needs its base table from step 1 or step 2 to already exist:

- `database/p1_leave_travel_workflow.sql` — needs `leave`, `travel`
- `database/p1_overtime_workflow.sql` — needs `overtime`
- `database/p1_disbursement_workflow.sql` — needs `disbursements`
- `database/p1_loan_workflow.sql` — needs `loans`
- `database/p1_probation_workflow.sql` — needs `probation_confirmations`
- `database/p1_resignation_workflow.sql` — needs `resignations`
- `database/p1_salary_adjustment_workflow.sql` — needs `salary_adjustments`

## 6. Demo/testing data (optional)

Only needed for local demo data, never on a shared or live database:

1. `database/demo_seed.sql`
2. `sql/demo_leave_balances.sql` — needs `leave_balances` (step 2)
3. `database/demo_cc_seed.sql` — needs the workflow tables from step 5

## Notes

- Loan is an active module: its base `loans` table is in `base_schema.sql`;
  its approval/CC/notification tables come from `p1_loan_workflow.sql`.
- Do not import a full development database dump into another developer's
  database unless you intentionally want its test requests, approval
  history, and notifications.
- Demo credentials in `demo_seed.sql` are for local testing only.
- **Keep this file in sync.** When a new `.sql` file is added under `sql/`
  or `database/`, add it here in the right section before merging, so the
  next person (or your own future self) doesn't hit a missing-table error
  the way this list used to cause.
