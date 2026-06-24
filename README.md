# SwahiliPot IMS — Internal Management System

An internal management system for **Swahilipot Hub Foundation**, a youth-empowerment
NGO based in Mombasa, Kenya. SwahiliPot IMS digitizes the organization's internal
operations: department form submissions, trainee attendance tracking (via QR code),
and radio frequency downtime reporting.

This is a *staff-only* tool used by Supervisors and Instructors. Trainees interact
only through a single public, login-free QR-scanned attendance page.

- **Organization:** Swahilipot Hub Foundation (founded 2016)
- **Location:** Swahili Cultural Centre, Sir Mbarak Hinaway Rd, Old Town, Mombasa, Kenya
- **Website:** swahilipothub.co.ke

---

## Tech Stack

**Backend** — Node.js · Express · plain JavaScript · PostgreSQL (raw SQL via `pg`,
no ORM) · JWT in HttpOnly cookies · Multer + AWS S3 (multer-s3) for file uploads ·
Nodemailer (password-reset email) · `qrcode` · bcrypt ·
dotenv + Zod env validation · CORS scoped to the frontend origin.

**Frontend** — React (Vite) · plain JavaScript · Tailwind CSS · React Router v6 ·
Axios · React Context (auth only) · `qrcode.react` · Lucide React · date-fns /
date-fns-tz.

---

## Project Structure

```
swahilipot-ims/
  client/        React frontend (Vite)
  server/        Express backend
  README.md
```

---

## Prerequisites

- **Node.js 18+** (developed and tested on Node 22)
- **PostgreSQL 14+**

---

## Setup

### 1. Database

Create the database (the app creates tables automatically on boot as designed):

```bash
createdb swahilipot_ims
# or via psql:
#   CREATE DATABASE swahilipot_ims;
```

The schema requires the `pgcrypto` extension for `gen_random_uuid()`. The migration
enables it automatically, which requires a database role with permission to run
`CREATE EXTENSION` (typically the database owner or a superuser).

### 2. Server

```bash
cd server
cp .env.example .env      # then edit values (see below)
npm install
npm run migrate           # create tables (also runs automatically on `npm start`)
npm run seed              # insert departments + default accounts
npm start                 # starts on http://localhost:5000
```

The server validates its environment with Zod at startup and **crashes immediately**
if any required variable is missing or invalid.

### 3. Client

```bash
cd client
cp .env.example .env      # optional; defaults to http://localhost:5000/api
npm install
npm run dev               # starts on http://localhost:5173
```

Open <http://localhost:5173> and sign in with one of the seeded accounts below.

---

## Environment Variables

### `server/.env`

| Variable       | Description                                              | Example                                                       |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `PORT`         | Port the Express server listens on                       | `5000`                                                        |
| `DATABASE_URL` | PostgreSQL connection string                             | `postgresql://postgres:password@localhost:5432/swahilipot_ims`|
| `JWT_SECRET`   | Secret used to sign JWTs (min 16 chars)                  | `a_long_random_string`                                        |
| `CLIENT_URL`   | Allowed CORS origin (the React app)                      | `http://localhost:5173`                                       |
| `AWS_REGION`   | AWS region of the S3 bucket                              | `eu-central-1`                                                |
| `AWS_ACCESS_KEY_ID`     | IAM access key with `s3:PutObject` / `s3:GetObject` on the bucket | `AKIA...`                                  |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key                           | `wJalr...`                                                    |
| `S3_BUCKET`    | Name of the S3 bucket for uploaded files                 | `swahilipot-ims-uploads`                                      |
| `S3_ENDPOINT`  | *(optional)* Custom endpoint for S3-compatible providers (R2, MinIO) | `https://<acct>.r2.cloudflarestorage.com`        |
| `SMTP_HOST`    | *(optional)* SMTP server for password-reset emails       | `smtp.sendgrid.net`                                           |
| `SMTP_PORT`    | *(optional)* SMTP port (465 ⇒ implicit TLS)              | `587`                                                         |
| `SMTP_USER`    | *(optional)* SMTP username                               | `apikey`                                                     |
| `SMTP_PASS`    | *(optional)* SMTP password / API key                     | `SG.xxxxx`                                                    |
| `SMTP_FROM`    | *(optional)* From header for outgoing mail               | `SwahiliPot IMS <no-reply@swahilipothub.co.ke>`              |

#### Password-reset email (SMTP)

The "Forgot password?" flow emails a reset link. **SMTP is optional**: if the
`SMTP_*` variables are not set, the server does not fail — instead it prints the
reset link to its console (a development fallback) so the flow stays testable
without an email provider. Set the `SMTP_*` variables to send real emails in
production.

#### File storage (S3)

Uploaded submission attachments are stored in **Amazon S3** (or any S3-compatible
provider via `S3_ENDPOINT`), not on local disk. Objects are written under a
`submissions/` key prefix. Downloads are **streamed through the API** after the
department-scoping check, so the bucket can remain private — the client never
receives a direct object URL. The IAM principal needs `s3:PutObject` and
`s3:GetObject` on the bucket.

### `client/.env`

| Variable       | Description                         | Example                       |
| -------------- | ----------------------------------- | ----------------------------- |
| `VITE_API_URL` | Base URL of the backend API         | `http://localhost:5000/api`   |

---

## Database Migrations & Seed

- `npm run migrate` (in `server/`) — idempotently creates all tables. Also runs
  automatically every time the server boots (`npm start`).
- `npm run seed` (in `server/`) — idempotently inserts the 9 departments, one
  global system admin, and one supervisor + one instructor account per
  department. Safe to re-run.

---

## Default Login Credentials

All seeded accounts share the password **`Swahilipot@2024`**.

**System Administrator** (global, manages every account):

```
admin@swahilipothub.co.ke   /   Swahilipot@2024
```

Email format:

- Supervisor: `supervisor.<slug>@swahilipothub.co.ke`
- Instructor: `instructor.<slug>@swahilipothub.co.ke`

| Department            | Slug                   | Supervisor email                              | Instructor email                              |
| --------------------- | ---------------------- | --------------------------------------------- | --------------------------------------------- |
| Communication         | `communication`        | supervisor.communication@swahilipothub.co.ke  | instructor.communication@swahilipothub.co.ke  |
| Creatives             | `creatives`            | supervisor.creatives@swahilipothub.co.ke      | instructor.creatives@swahilipothub.co.ke      |
| Tech Department       | `tech`                 | supervisor.tech@swahilipothub.co.ke           | instructor.tech@swahilipothub.co.ke           |
| Community Experience  | `community-experience` | supervisor.community-experience@swahilipothub.co.ke | instructor.community-experience@swahilipothub.co.ke |
| Youth Engagement      | `youth-engagement`     | supervisor.youth-engagement@swahilipothub.co.ke | instructor.youth-engagement@swahilipothub.co.ke |
| Heritage              | `heritage`             | supervisor.heritage@swahilipothub.co.ke       | instructor.heritage@swahilipothub.co.ke       |
| Admin                 | `admin`                | supervisor.admin@swahilipothub.co.ke          | instructor.admin@swahilipothub.co.ke          |
| Finance               | `finance`              | supervisor.finance@swahilipothub.co.ke        | instructor.finance@swahilipothub.co.ke        |
| Entrepreneurship      | `entrepreneurship`     | supervisor.entrepreneurship@swahilipothub.co.ke | instructor.entrepreneurship@swahilipothub.co.ke |

> **Change these passwords before any real deployment.**

Notes on department capabilities:

- **Trainees & Attendance** are available to instructors in departments with
  `has_trainees = true` (all except Admin and Finance).
- **Downtime Reports** are available only to the **Communication** department
  (`has_radio_report = true`). The API rejects downtime requests from any other
  department.

---

## Feature Overview

| Area              | Instructor                                           | Supervisor                                              | System Admin                                  |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Dashboard         | Trainee/session/submission counts                    | Instructor/trainee counts, pending submissions          | System-wide account & activity stats          |
| Trainees          | Add, list, deactivate (own department)               | —                                                       | —                                             |
| Attendance        | Generate QR sessions, view & confirm check-ins       | Read-only view of department sessions                   | —                                             |
| Submissions       | File submissions with optional file attachment       | Acknowledge / return department submissions             | —                                             |
| Downtime (Comm)   | Report frequency downtime                             | Resolve open downtime reports                            | —                                             |
| Instructors       | —                                                    | Add instructors, toggle active status                   | —                                             |
| User Management   | —                                                    | —                                                       | Create / suspend / reset-password / delete all accounts, view profiles |
| Public Attendance | — (trainees scan the QR; no login)                   | —                                                       | —                                             |

### Cross-cutting features (all signed-in users)

- **Notifications** — an in-app bell with unread badge, a dropdown feed, and
  toast pop-ups (polled every 30s). Generated on submission filed / acknowledged /
  returned, downtime reported / resolved, and account actions.
- **Profile & Account Settings** — view your profile, edit your display name,
  and change your own password (current password required).
- **Light / Dark theme** — a per-user toggle (top bar or Account Settings),
  persisted in the browser. Public pages (login, attendance) stay light.
- **Password reset** — a public "Forgot password?" flow emails a one-time,
  60-minute reset link. The System Admin can also reset any account's password
  directly. (See SMTP note below.)

---

## Security & Data Scoping

- All authenticated routes require a valid JWT stored in an **HttpOnly cookie**.
- **Department scoping is enforced in SQL** — every query filters by
  `department_id`, so staff can never see or act on another department's data.
- The public `/api/attend/:token` routes require **no cookie or auth header** and
  are fully usable on a mobile browser.
- `password_hash` is never returned by any endpoint.
- Timestamps are stored in **UTC** and displayed in **East Africa Time (UTC+3)**.

---

## Available Scripts

**server/**

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm start`      | Run migrations, then start the API server    |
| `npm run dev`    | Same, with `--watch` auto-restart            |
| `npm run migrate`| Create/ensure database tables                |
| `npm run seed`   | Insert departments and default accounts      |

**client/**

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start the Vite dev server    |
| `npm run build`   | Production build             |
| `npm run preview` | Preview the production build |
