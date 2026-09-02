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
