# SwahiliPot IMS — Internal Management System

An internal management system for **Swahilipot Hub Foundation**, a youth-empowerment
NGO based in Mombasa, Kenya. SwahiliPot IMS digitises the organisation's internal
operations: department management, trainee attendance (via QR code), attachee
(industrial-attachment student) management, task assignment and review, form
submissions, radio-frequency downtime reporting, programmes/cohorts, session logs,
announcements, AI-assisted performance analysis, certificate generation, a visitor
log, and a system-admin control panel. It also powers an admin-editable public
landing page whose every section — including hero and about **images or videos**
(YouTube/Vimeo links or direct files) — is managed from the admin CMS.

This is a **staff-only** tool. Trainees never log in — they interact only through a
single public, login-free QR-scanned attendance page.

- **Organisation:** Swahilipot Hub Foundation (founded 2016)
- **Location:** Swahili Cultural Centre, Sir Mbarak Hinawy Rd, Old Town, Mombasa, Kenya
- **Website:** swahilipothub.co.ke

> For a feature-by-feature end-user manual see [`docs/SwahiliPot_IMS_User_Manual.md`](docs/SwahiliPot_IMS_User_Manual.md).
> For a deep technical walkthrough see [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).

---

## Roles

| Role | Logs in? | Scope | Purpose |
| --- | --- | --- | --- |
| **System Administrator** (`admin`) | Yes | Global (no department) | Manages all accounts, departments, audit log, platform settings, landing-page CMS, and AI usage from a dedicated admin panel. |
| **Supervisor** (`supervisor`) | Yes | One department | Oversees the department: instructors, attachees, submissions, announcements, downtime, programmes, performance, AI features, certificates. |
| **Instructor** (`instructor`) | Yes | One department | Day-to-day: trainees, QR attendance, attachees, tasks, session logs, submissions, downtime, visitor log. |
| **Attachee** (`attachee`) | Yes | One department | University student on attachment: own tasks, daily check-in, reminders, inquiries, profile. |
| **Trainee** | **No login** | — | Community learner. Interacts only through the public QR attendance page. |

> **Trainees** (community learners, attendance only) and **Attachees** (university
> students on formal attachment, with login accounts) are distinct concepts.
> Tasks, performance tracking, and AI analysis apply to **attachees**, not trainees.

---

## Tech Stack

**Backend** — Node.js · Express · plain JavaScript · PostgreSQL (raw SQL via `pg`,
no ORM) · JWT in HttpOnly cookies · bcrypt · Multer + AWS S3 (`multer-s3`) for file
uploads · Brevo HTTP API for transactional email (Nodemailer SMTP fallback) ·
`pdfkit` for server-side PDFs (certificates, AI reports) · `openai` SDK pointed at
**NVIDIA NIM** for the AI layer · Zod env validation · dotenv · CORS scoped to the
frontend origin.

**Frontend** — React 18 (Vite) · plain JavaScript · Tailwind CSS (CSS-variable theme
tokens, light/dark) · React Router v6 · Axios (`withCredentials`) · React Context
(auth, theme, toast) · `qrcode.react` · Lucide React · `date-fns` / `date-fns-tz`
(East Africa Time) · `jspdf` + `jspdf-autotable` (client-side table exports) · a
dependency-free SVG radar chart · dependency-free SVG **leso/kanga** patterns and a
CSS-only ocean-motion library (all honouring `prefers-reduced-motion`).

The UI carries a **Swahili-coast / Indian-Ocean visual identity** — deep-ocean blue
joined by lagoon teal, coral, and Swahili brass-door gold, with animated waves, a
hanging-kanga hero motif, and leso cloth patterns scattered across the landing page.
It is **fully responsive**: a fixed sidebar on desktop and a slide-in drawer (opened
from a hamburger in the top bar) on tablets and phones. The logo doubles as a home
link, as on the official site.

---

## Project Structure

```
swahilipot-ims/
  client/        React frontend (Vite)
  server/        Express backend
  docs/          User manual + developer guide
  README.md
```

---

## Prerequisites

- **Node.js 18+** (developed and tested on Node 22)
- **PostgreSQL 14+** (the production deployment uses Neon serverless Postgres)

---

## Setup

### 1. Database

Create the database (the app creates and upgrades tables automatically on boot):

```bash
createdb swahilipot_ims
# or via psql:  CREATE DATABASE swahilipot_ims;
```

The schema requires the `pgcrypto` extension for `gen_random_uuid()`. The migration
enables it automatically, which requires a role with permission to run
`CREATE EXTENSION` (typically the database owner or a superuser).

### 2. Server

```bash
cd server
cp .env.example .env      # then edit values (see Environment Variables)
npm install
npm run migrate           # create/upgrade tables (also runs automatically on `npm start`)
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

| Variable | Required? | Description |
| --- | --- | --- |
| `PORT` | no (default `5000`) | Port the Express server listens on. |
| `DATABASE_URL` | **yes** | PostgreSQL connection string. |
| `JWT_SECRET` | **yes** (≥16 chars) | Secret used to sign JWTs. |
| `CLIENT_URL` | **yes** | Allowed CORS origin (the React app); also used to build reset/email links. |
| `STORAGE_DRIVER` | no (`s3` / `local`) | Where uploads go. Auto-detects S3 when credentials are present. |
| `UPLOADS_DIR` | no (default `./uploads`) | Local upload folder when using disk storage. |
| `AWS_REGION` | only for S3 | Region of the S3 bucket — must be the bucket's **real** region. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | only for S3 | IAM credentials with `s3:PutObject` / `s3:GetObject` on the bucket. |
| `S3_BUCKET` | only for S3 | Name of the S3 bucket for uploaded files. |
| `S3_ENDPOINT` | no | Custom endpoint for S3-compatible providers (Cloudflare R2, MinIO). |
| `BREVO_API_KEY` | for email | Brevo transactional HTTP API key (preferred — works where SMTP is blocked). |
| `MAIL_FROM_EMAIL` / `MAIL_FROM_NAME` | for email | The **verified** sender address and display name. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | SMTP fallback used only if `BREVO_API_KEY` is unset. |
| `NVIDIA_NIM_API_KEY` | for AI | NVIDIA NIM API key (starts with `nvapi-`) for the AI layer. Falls back to `NVIDIA_API_KEY`. |
| `NVIDIA_API_KEY` | for chatbot/AI | NVIDIA API key shared with the public chatbot proxy. |
| `NVIDIA_NIM_MODEL` / `NVIDIA_NIM_FAST_MODEL` | no | Override the AI models. Defaults to `meta/llama-3.3-70b-instruct` with fallback. Do **not** set to a Kimi K2 model (end-of-life on NIM). |

> **Email:** if no email provider is configured, password-reset links are printed to
> the server console as a development fallback, so the flow stays testable.
>
> **AI:** if no NVIDIA key is configured, AI endpoints return a graceful `503` and the
> rest of the system works normally. AI can also be switched off platform-wide from
> **Platform Settings** without changing any environment variable.

### `client/.env`

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Base URL of the backend API | `http://localhost:5000/api` |

---

## Database Migrations & Seed

- `npm run migrate` (in `server/`) — idempotently creates and upgrades all tables.
  Runs automatically every time the server boots.
- `npm run seed` (in `server/`) — idempotently inserts the nine departments, one
  global system admin, and one supervisor + one instructor per department. Safe to
  re-run.
- `npm run seed:ai-demo` (in `server/`) — inserts three demo attachees in the Tech
  Department with roughly four weeks of check-ins, domain-themed tasks, and notes,
  so the AI intelligence profiles and competency radars can be demonstrated. Demo
  accounts use `@demo.swahilipot.test` emails and re-running resets them.

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

| Department | Slug | Supervisor email | Instructor email |
| --- | --- | --- | --- |
| Communication | `communication` | supervisor.communication@swahilipothub.co.ke | instructor.communication@swahilipothub.co.ke |
| Creatives | `creatives` | supervisor.creatives@swahilipothub.co.ke | instructor.creatives@swahilipothub.co.ke |
| Tech Department | `tech` | supervisor.tech@swahilipothub.co.ke | instructor.tech@swahilipothub.co.ke |
| Community Experience | `community-experience` | supervisor.community-experience@swahilipothub.co.ke | instructor.community-experience@swahilipothub.co.ke |
| Youth Engagement | `youth-engagement` | supervisor.youth-engagement@swahilipothub.co.ke | instructor.youth-engagement@swahilipothub.co.ke |
| Heritage | `heritage` | supervisor.heritage@swahilipothub.co.ke | instructor.heritage@swahilipothub.co.ke |
| Admin | `admin` | supervisor.admin@swahilipothub.co.ke | instructor.admin@swahilipothub.co.ke |
| Finance | `finance` | supervisor.finance@swahilipothub.co.ke | instructor.finance@swahilipothub.co.ke |
| Entrepreneurship | `entrepreneurship` | supervisor.entrepreneurship@swahilipothub.co.ke | instructor.entrepreneurship@swahilipothub.co.ke |

> **Change these passwords before any real deployment.**

Department capabilities:

- **Trainees & Attendance** are available to instructors in departments with
  `has_trainees = true` (all except Admin and Finance).
- **Attachees, Tasks, Programs, Performance** apply to the same departments.
- **Downtime Reports** are available only to the **Communication** department
  (`has_radio_report = true`). The API rejects downtime requests from any other
  department.

---

## Feature Overview

| Area | Instructor | Supervisor | Attachee | System Admin |
| --- | --- | --- | --- | --- |
| Dashboard | Trainee/session/submission counts | Department counts, pending work, activity feed | Attachment progress, tasks, deadlines | Org-wide stats |
| Trainees | Add, list, deactivate, CSV import | — | — | — |
| Attendance (QR) | Generate sessions, confirm check-ins | Read-only department view | — | — |
| Attachees | Add, edit (own dept) | Add, edit, deactivate | View own profile | — |
| Tasks | Assign, review, comment | Assign, review, comment | Update status, comment | — |
| Submissions | File (with attachment) | Acknowledge / return | — | — |
| Session Logs | Write daily logs | Read department logs | — | — |
| Announcements | Read | Post / edit / delete | Read | — |
| Downtime (Comm) | Report | Resolve | — | (escalation notice) |
| Programs / Cohorts | Link sessions/tasks | Create, enrol members | — | — |
| Performance | — | View + CSV export | — | — |
| AI (profiles, reports, assistant) | — | Full access | — | (usage stats + on/off toggle) |
| Certificates | Trainee certificate | Attachee letter/certificate + trainee | — | — |
| Visitor Log | Log + view | View department | — | (can log) |
| User Management | — | (instructors only, via Instructors) | — | All accounts, every department |
| Departments / Audit / Platform Settings / CMS / AI Usage | — | — | — | Full access |

### Cross-cutting features (all signed-in users)

- **Notifications** — an in-app bell with an unread badge and a dropdown feed.
  Triggered on submissions, tasks, announcements, downtime, and account actions.
- **Profile & Account Settings** — view your profile; edit name, phone, bio, and
  profile photo; change your own password.
- **Light / Dark theme** — a per-user toggle, persisted in the browser. Public pages
  (landing, login, attendance) stay light. Dark mode is a deep "midnight ocean".
- **Responsive layout** — works across phones, tablets, and desktops. The portal nav
  is a fixed rail at ≥768px and a slide-in drawer (hamburger in the top bar) below it;
  data tables scroll horizontally on narrow screens.
- **Animated login** — a live ocean scene (rolling SVG waves, a swaying dhow, rising
  sparkles, a *Karibu* welcome) beside the sign-in card.
- **Password reset** — a public "Forgot password?" flow emails a one-time, 60-minute
  reset link. The System Admin can also reset any account's password directly.
- **Landing-page chatbot** — a public Q&A widget (landing page only) answering
  questions strictly about Swahilipot Hub, proxied server-side through NVIDIA.

---

## AI Layer

AI features are available to **Supervisors** and are served by a large language model
through **NVIDIA NIM** (NVIDIA Inference Microservices) using the OpenAI-compatible
API. They operate only on the supervisor's own department data.

- **Intelligence Profile** — a structured, evidence-based analysis of an attachee
  (strengths, growth areas, behavioural patterns, skill tags, a six-axis competency
  radar, three suggested career paths, and an overall assessment). Generation streams
  over Server-Sent Events so it never hits a reverse-proxy timeout, and the result is
  cached per attachee.
- **AI Reports** — streamed progress reports and completion letters that the
  supervisor can edit, finalise, and export as a branded PDF.
- **AI Assistant** — a threaded chat answering natural-language questions about the
  department from its real data; it cannot act on the system or reach the internet.
- **AI Usage & toggle** — the System Admin sees usage statistics and can disable all
  AI platform-wide. All AI output is labelled "Generated by AI via NVIDIA NIM".

> The earlier Kimi K2 model reached end-of-life on NVIDIA NIM; the system uses
> `meta/llama-3.3-70b-instruct` with an automatic fallback chain.

---

## Document Signing (fraud prevention)

Every generated PDF — attachment letters, completion certificates, AI progress
reports, and trainee certificates — is assigned a unique **Document ID**
(`SPH-2026-ATT-A7F3K9`), **SHA-256 hashed**, and **signed with the server's
Ed25519 private key**. A verification footer with a QR code is embedded in the
PDF, and the record is stored in the `documents` table. Anyone (a university,
employer, or government office) can verify a document at the public page
`/verify/:document_id` — view its provenance, upload the PDF to detect any
alteration, or download the public key to verify the signature independently.

**Key generation** — run once, then paste the output into `server/.env`:

```bash
cd server && node src/utils/generateKeys.js
```

Set `DOCUMENT_SIGNING_PRIVATE_KEY`, `DOCUMENT_SIGNING_PUBLIC_KEY` (PEM with
newlines escaped as `\n`), and `VERIFICATION_BASE_URL`. **Never commit the
private key.** If the keys are absent the server still boots — signing is simply
disabled and PDFs generate without the verification footer.

- **Algorithm:** Ed25519 (built into Node's `crypto`, no extra packages). The
  signed payload binds the content hash to the Document ID and timestamp, so a
  signature can't be transplanted onto another document, and any single-character
  change to the PDF fails verification.
- **Public key endpoint:** `GET /api/verify/public-key` serves the PEM publicly.
- **Revocation:** supervisors can revoke their department's documents (admins any);
  a revoked document shows a clear warning on the verification page.
- **Key rotation:** if the private key is compromised, generate a new pair, update
  `.env`, and restart. Documents signed with the old key will show as
  signature-invalid on upload, but their existence records are preserved. Record
  the rotation date here when it happens.
- **Network:** `/verify/*` must be reachable from the public internet without
  login or VPN — it is the interface external parties use to check documents.

---

## Security & Data Scoping

- All authenticated routes require a valid JWT stored in an **HttpOnly cookie**. The
  token and its cookie expire after **12 hours**, so sessions don't linger.
- **Department scoping is enforced in SQL** — department queries filter by the trusted
  `department_id` from the token, so staff can never see or act on another
  department's data.
- The public `/api/attend/:token` and `/api/site/content` routes require **no auth**.
- `password_hash` is never returned by any endpoint.
- **Maintenance mode** (a platform setting) blocks all non-admin API traffic with a
  `503` while leaving admins and the auth endpoints working.
- Timestamps are stored in **UTC** and displayed in **East Africa Time (UTC+3)**.

---

## Available Scripts

**server/**

| Command | Description |
| --- | --- |
| `npm start` | Run migrations, then start the API server |
| `npm run dev` | Same, with `--watch` auto-restart |
| `npm run migrate` | Create/upgrade database tables |
| `npm run seed` | Insert departments and default accounts |
| `npm run seed:ai-demo` | Insert three demo attachees with data for AI features |
| `npm run mail:test` | Send a test email and print the provider's response |

**client/**

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

---

## Production Deployment

The system runs on a Linux VPS. **Nginx** serves the built frontend (`client/dist`)
and proxies `/api` to the Node/Express server (kept alive by **PM2**, port 5000),
which connects to Postgres and S3. A typical redeploy:

```bash
cd ~/Swahili-Pot-Project && git pull origin main
cd server && npm install --omit=dev
cd ../client && npm install && npm run build
pm2 restart sph-api
```

The server runs `migrate()` on boot, so schema changes apply automatically on restart.
For AI report/profile generation (long model calls), Nginx should allow a generous
`proxy_read_timeout` on the `/api` location; profile generation also streams to avoid
timeouts.
