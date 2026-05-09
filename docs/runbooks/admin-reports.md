# Admin Passage Reports

## Scope

Minimal admin page for reviewing passage reports submitted through the report
button in the reading UI.

## Live Page

```bash
https://ieltstok.online/admin
```

## Authentication

This page does not use Clerk. The API reads admin credentials from
`/opt/readtok/.env.production`:

```bash
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
```

Do not commit these values to Git.

## Backend Endpoints

- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/reports`

The login route sets an HTTP-only admin session cookie.

## Data Source

Report counts come from `passage_report_counts`, grouped by passage and report
type. The dashboard sorts passages by total report count, then latest report
time.

