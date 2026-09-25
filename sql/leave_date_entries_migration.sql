-- Adds a column to store the itemized date-entry breakdown for leave applications
-- that cover multiple non-contiguous date ranges or mixed day types in one
-- submission (e.g. Friday full day + Monday half day, skipping the weekend).
--
-- `Start Date` / `End Date` / `Day type` / `No of Days` on the `leave` table stay
-- as the overall summary (min start, max end, 'mixed' when entries differ, and
-- the total across all entries) so every existing query, report, and the
-- approval queue keep working unchanged. `Date Entries` holds the full
-- breakdown as JSON for display/audit, and is NULL for the common single-entry
-- case (kept NULL there on purpose, to avoid bloating every row with a
-- redundant single-item array).
--
-- Run this once against your local DB:
--   mysql -u root -p oa_portal < sql/leave_date_entries_migration.sql

ALTER TABLE `leave`
    ADD COLUMN `Date Entries` TEXT NULL DEFAULT NULL
    COMMENT 'JSON array of {start_date,end_date,day_type,days} - only populated when a submission has more than one date entry';
