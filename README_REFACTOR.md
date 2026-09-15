# FocusInsight OA — Refactored Structure

The project has been refactored without changing the existing API endpoint paths.

## Frontend

Inline CSS and JavaScript were moved out of the HTML pages:

- `assets/css/...` — page-specific CSS extracted from `<style>` blocks.
- `assets/js/...` — page-specific JavaScript extracted from inline `<script>` blocks.
- Existing external JavaScript files were kept in their original locations.

The HTML files now contain structure/markup plus external stylesheet/script references.

## Backend

`server.js` is now the application bootstrap only.

```text
server.js
config/
  database.js
middleware/
  auth.js
  upload.js
routes/
  index.js
  dashboard.routes.js
  auth.routes.js
  leave.routes.js
  request.routes.js
  approval.routes.js
  hr.routes.js
  users.routes.js
  reports.routes.js
  reminder.routes.js
  workflow.routes.js
utils/
  helpers.js
```

### Route responsibilities

- `auth.routes.js` — login and notifications
- `leave.routes.js` — leave information and leave submission
- `request.routes.js` — disbursement, travel, allowance, overtime, loan, salary adjustment, probation and request details
- `approval.routes.js` — approval queue
- `hr.routes.js` — HR dashboard, processing and CEO booking
- `users.routes.js` — users, profiles, departments and employee IDs
- `reports.routes.js` — reports
- `reminder.routes.js` — request reminders
- `workflow.routes.js` — workflow settings
- `dashboard.routes.js` — dashboard redirect

Shared database, upload, authentication and helper logic are separated into their own modules.

## Merge notes (this copy)

This copy merges in features that existed in the pre-refactor version but
were missing here after the structural refactor + branch merge:

- **Recruitment requisition form** — `Recruitment requisition form.html`,
  `routes/legacy-forms.routes.js` (manager-only, shown on Application Center).
- **Manpower outsourcing request** — `hr/manpower-outsourcing-request.html`,
  same routes file. Already linked from `hr/hr-operation.html`.
- **Resignation request form** — `hr/resignation-request-form.html`
  (renamed from the original `resignation-form.html` to match the link
  already present in `hr-operation.html`), same routes file.
- **India e-business visa application** — `hr/visa-application-hr.html`
  (re-added to the shared HR form tab bar) and the employee-facing
  `visa-application-form.html` (was already present but disabled on the
  Application Center — now enabled), same routes file.
- **Printing production request** — `printing-production-request.html` and
  `routes/printing-production.js` (existed on disk but was never mounted —
  now wired into `routes/index.js` and enabled on the Application Center).
- **Request resubmission** — `/api/resubmit-request` was defined in an
  orphaned `routes/requests.js` that was never mounted; the endpoint has
  been moved into `request.routes.js` and the orphan file removed.
- **Reports** — `/api/reports` search/filter fields and the profile-picture
  join were restored, along with the `/api/generate-reports` Excel/PDF
  export endpoint and the daily auto-report cron job (`exceljs`,
  `node-cron`, `pdfkit` added back to `package.json`). The report output
  folder is now configurable via `REPORTS_DIR` instead of a hardcoded
  Windows path.

### Known issue not addressed here

Many of the extracted `assets/js/*.js` files (and a couple of HTML files)
call the API using a hardcoded `http://localhost:3000` origin instead of a
relative path. This will break the app once deployed anywhere other than
that exact host/port. It wasn't touched in this merge since it's a
pre-existing issue in the refactor rather than something missing from the
original — worth a follow-up pass to change these back to relative paths.

## Run

The `node_modules` directory is intentionally not included in the cleaned archive.

```bash
npm install
npm start
```

The server uses these environment variables when supplied:

- `PORT`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Defaults remain compatible with the previous local setup.
