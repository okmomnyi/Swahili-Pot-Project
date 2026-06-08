# SwahiliPot IMS — Developer Guide (Deep Dive)

> A complete, no-assumptions explanation of how the SwahiliPot Internal Management
> System is built and how every part works. This is written for someone who has
> **never seen the project** and wants to understand it deeply — deeper than the
> README. If a term is used, it is explained.

---

## Table of contents

1. [What the system is](#1-what-the-system-is)
2. [The big picture (architecture)](#2-the-big-picture-architecture)
3. [The technologies and why each is used](#3-the-technologies-and-why-each-is-used)
4. [How the code is organised (folders & files)](#4-how-the-code-is-organised-folders--files)
5. [The database (every table)](#5-the-database-every-table)
6. [How a request flows end to end](#6-how-a-request-flows-end-to-end)
7. [Authentication (who are you?)](#7-authentication-who-are-you)
8. [Cookies & JWT in full detail](#8-cookies--jwt-in-full-detail)
9. [Authorization (what are you allowed to do?)](#9-authorization-what-are-you-allowed-to-do)
10. [Roles and their exact permissions](#10-roles-and-their-exact-permissions)
11. [How a user reaches the correct dashboard](#11-how-a-user-reaches-the-correct-dashboard)
12. [Department scoping (the core data-isolation rule)](#12-department-scoping-the-core-data-isolation-rule)
13. [Feature walkthroughs](#13-feature-walkthroughs)
14. [File uploads & storage](#14-file-uploads--storage)
15. [Email (password reset)](#15-email-password-reset)
16. [PDF export](#16-pdf-export)
17. [The public website (CMS)](#17-the-public-website-cms)
18. [Security summary (everything we do)](#18-security-summary-everything-we-do)
19. [Configuration (environment variables)](#19-configuration-environment-variables)
20. [How it runs in production (deployment)](#20-how-it-runs-in-production-deployment)
21. [Glossary](#21-glossary)

---

## 1. What the system is

**SwahiliPot IMS** ("Internal Management System") is a web application for **Swahilipot
Hub Foundation**, a youth-empowerment NGO in Mombasa, Kenya. It digitises internal
operations:

- **Department form submissions** (instructors send documents to supervisors)
- **Trainee attendance** via QR codes scanned on phones
- **Radio frequency downtime reporting** (Communication department only)
- **An internship/attachment programme** (tasks, check-ins, reminders, inquiries)
- **A public marketing website** that staff (admins) can edit
- **Account management** by a system administrator

There are **two kinds of users**:

- **Staff** who log in: `admin`, `supervisor`, `instructor`, `attachee`.
- **Trainees**, who never log in — they only scan a QR code and submit a form.

---

## 2. The big picture (architecture)

The project is a **monorepo**: one repository containing two separate applications.

```
swahilipot-ims/
├── client/   ← the frontend (what the browser shows) — React
└── server/   ← the backend (the API + database access) — Node/Express
```

These two talk to each other over **HTTP** using a **REST API** (the backend exposes
URLs like `/api/auth/login`, and the frontend calls them).

```
┌───────────────┐    HTTP requests (JSON)     ┌───────────────┐     SQL      ┌────────────┐
│   Browser     │  ───────────────────────►   │  Express API  │  ─────────►  │ PostgreSQL │
│ (React app)   │  ◄───────────────────────   │  (Node.js)    │  ◄─────────  │  (Neon)    │
└───────────────┘    JSON responses           └───────────────┘              └────────────┘
        │                                              │
        │ uploads/downloads                            │ stores files
        └───────────────────────────────────► Amazon S3 (or local disk)
```

- The **frontend** is a "Single-Page Application" (SPA). The browser downloads one
  HTML file plus JavaScript, and from then on the JavaScript draws all pages and
  fetches data from the API. The page never does a full reload when you navigate.
- The **backend** is an **Express** server. It has no HTML — it only answers API
  requests with JSON, reads/writes the database, and stores files.
- The **database** is **PostgreSQL**, hosted on **Neon** (a cloud Postgres provider).
- **Files** (uploaded documents, partner logos) go to **Amazon S3** (a cloud file
  store) — or to local disk if S3 isn't configured.

In production, a web server called **Nginx** sits in front of everything: it serves
the built frontend files and forwards any request starting with `/api` to the Express
backend. (See [section 20](#20-how-it-runs-in-production-deployment).)

---

## 3. The technologies and why each is used

### Backend (`server/`)

| Technology | What it is | How we use it |
|---|---|---|
| **Node.js** | A runtime that executes JavaScript outside the browser. | Runs the whole backend. |
| **Express** | A minimal web framework for Node. | Defines API routes (`/api/...`) and middleware. |
| **PostgreSQL** | A relational (SQL) database. | Stores all data in tables. |
| **`pg`** | The Node driver that talks to PostgreSQL. | We write **raw SQL** with it — no ORM. Every query is hand-written, which makes data access explicit and auditable. |
| **`jsonwebtoken` (JWT)** | Creates/verifies signed tokens. | Proves who a logged-in user is (see [section 8](#8-cookies--jwt-in-full-detail)). |
| **`bcrypt`** | A password-hashing library. | Hashes passwords so we never store them in plain text. |
| **`cookie-parser`** | Express middleware that reads cookies. | Lets us read the auth cookie from incoming requests. |
| **`cors`** | Controls which websites may call the API. | Locked to the frontend origin only. |
| **`multer` + `multer-s3`** | File-upload handling. | Receives uploaded files and streams them to S3 (or disk). |
| **`@aws-sdk/client-s3`** | Amazon's S3 client. | Reads/writes files in the S3 bucket. |
| **`qrcode`** | Generates QR codes. | (QR display is actually done on the frontend; backend creates session tokens.) |
| **`nodemailer`** + **Brevo HTTP API** | Sends email. | Password-reset emails. Brevo's HTTP API is preferred because cloud hosts often block SMTP. |
| **`zod`** | A schema validator. | Validates environment variables at startup and crashes if any required one is missing/invalid. |
| **`dotenv`** | Loads variables from a `.env` file. | Provides secrets/config to the server. |

### Frontend (`client/`)

| Technology | What it is | How we use it |
|---|---|---|
| **React 18** | A UI library for building components. | The whole interface is React components. |
| **Vite** | A build tool / dev server. | Bundles the app for production (`npm run build`) and serves it during development. |
| **Tailwind CSS** | A utility-CSS framework. | Styling is done with class names like `bg-card text-ink`. |
| **React Router v6** | Client-side routing. | Maps URLs (`/dashboard`, `/trainees`) to components, with no page reloads. |
| **Axios** | An HTTP client. | Calls the API. Configured once with `withCredentials: true` so cookies are sent. |
| **React Context API** | Built-in React state sharing. | Holds **auth state** (current user), **theme** (light/dark), and **toast** notifications. No Redux. |
| **`qrcode.react`** | Renders QR codes in the browser. | Draws the attendance QR code. |
| **`lucide-react`** | An icon set. | All the icons. |
| **`date-fns` + `date-fns-tz`** | Date formatting + timezones. | Shows all times in **East Africa Time (UTC+3)**. |
| **`jspdf` + `jspdf-autotable`** | Generates PDFs in the browser. | The "Export PDF" buttons. Lazy-loaded so they don't bloat the initial download. |

> **"No ORM," "no Redux," "plain JavaScript (no TypeScript)"** are deliberate
> simplicity choices: the data layer is explicit SQL, and state is plain React.

---

## 4. How the code is organised (folders & files)

### Backend

```
server/
├── index.js                 # Entry point: load env, validate, migrate, start server
├── package.json             # Dependencies + npm scripts (start, migrate, seed, mail:test)
├── .env                     # Secrets/config (NOT committed)
├── .env.example             # Template showing which variables exist
└── src/
    ├── app.js               # Builds the Express app: middleware + mounts all routes + error handler
    ├── config/
    │   └── env.js           # Zod schema that validates environment variables
    ├── db/
    │   ├── pool.js          # The single PostgreSQL connection pool
    │   ├── schema.sql       # CREATE TABLE statements (the full schema)
    │   ├── migrate.js       # Runs schema.sql + idempotent ALTERs on boot
    │   └── seed.js          # Inserts default departments + accounts
    ├── middleware/
    │   ├── auth.js          # verifyToken — checks the JWT cookie
    │   ├── requireRole.js   # requireRole(...) — checks the user's role
    │   └── upload.js        # multer config (S3 or local disk)
    ├── lib/
    │   ├── s3.js            # S3 client + storage-driver decision + startup check
    │   ├── mailer.js        # Email sending (Brevo API / SMTP)
    │   ├── emailTemplate.js # The branded HTML email template
    │   ├── notify.js        # Helpers to create in-app notifications
    │   └── siteDefaults.js  # Default content for the public website
    ├── routes/              # One file per feature area (see below)
    └── scripts/
        └── testMail.js      # `npm run mail:test <email>` diagnostic
```

**Route files** (each exports an Express `Router` mounted under a URL prefix in `app.js`):

| File | Mounted at | Purpose |
|---|---|---|
| `auth.js` | `/api/auth` | login, logout, me, profile, change/forgot/reset password |
| `departments.js` | `/api/departments` | list departments |
| `users.js` | `/api/users` | supervisor manages instructors |
| `trainees.js` | `/api/trainees` | instructor manages trainees |
| `attendance.js` | `/api/attendance` | sessions, records, confirm, rename/delete, range export |
| `attend.js` | `/api/attend` | **public** QR check-in (no auth) |
| `submissions.js` | `/api/submissions` | form submissions + file up/download |
| `downtime.js` | `/api/downtime` | radio downtime reports (Comm dept) |
| `dashboard.js` | `/api/dashboard` | role-aware dashboard counts |
| `notifications.js` | `/api/notifications` | the bell icon's data |
| `admin.js` | `/api/admin` | system admin: all-user management + stats |
| `tasks.js` | `/api/tasks` | attachee tasks |
| `attachee.js` | `/api/attachee` | check-ins, reminders, attachee dashboard |
| `inquiries.js` | `/api/inquiries` | attachee ↔ staff threaded messages |
| `site.js` | `/api/site` | **public** website content + admin editing |

### Frontend

```
client/
├── index.html               # The single HTML page (loads the React app, fonts, favicons)
├── vite.config.js           # Dev proxy: forwards /api to localhost:5000
├── tailwind.config.js        # Theme tokens (brand colours, light/dark)
└── src/
    ├── main.jsx             # Mounts <App/> wrapped in all the Context Providers
    ├── App.jsx              # All the routes (URL → component map)
    ├── index.css            # Tailwind + CSS variables for theming + animations
    ├── api/                 # One file per backend area; thin wrappers around Axios
    │   └── axios.js         # The configured Axios instance (baseURL + withCredentials)
    ├── context/
    │   ├── AuthContext.jsx  # Current user, login(), logout()
    │   └── ThemeContext.jsx # light/dark theme
    ├── components/
    │   ├── layout/          # Sidebar, TopBar, Layout, NotificationsBell
    │   └── ui/              # Reusable widgets: Button, Input, Modal, Table, Badge, Toast...
    ├── routes/
    │   ├── PrivateRoute.jsx # "must be logged in"
    │   └── RoleRoute.jsx    # "must be logged in AND have this role"
    ├── lib/
    │   ├── datetime.js      # EAT formatting helpers
    │   ├── pdf.js           # Branded PDF exporter
    │   └── calendar.js      # Google-Calendar link + .ics for reminders
    └── pages/               # One folder per feature; the actual screens
```

---

## 5. The database (every table)

All tables live in `server/src/db/schema.sql`. All timestamps are stored in **UTC**
(the `TIMESTAMPTZ` type) and converted to EAT only when displayed. IDs are
auto-incrementing integers (`SERIAL`) unless noted.

| Table | What each row represents | Key columns |
|---|---|---|
| `departments` | A department / programme unit (9 of them). | `name`, `slug`, `has_trainees`, `has_radio_report` |
| `users` | A staff account. | `name`, `email` (unique), `password_hash`, `role`, `department_id` (NULL for admin), `is_active` |
| `trainees` | A trainee enrolled in a department. | `name`, `phone`, `department_id`, `added_by`, `is_active` |
| `attendance_sessions` | One QR attendance session (valid 3 hours). | `instructor_id`, `department_id`, `token` (UUID), `session_label`, `expires_at` |
| `attendance_records` | One trainee's check-in within a session. | `session_id`, `trainee_name`, `trainee_phone`, `check_in`, `is_confirmed` |
| `form_submissions` | A document/form an instructor or attachee filed. | `instructor_id` (the filer), `department_id`, `form_type`, `title`, `file_url`, `file_storage`, `status`, `task_id` |
| `downtime_reports` | A radio frequency outage report. | `instructor_id`, `frequency_band`, `severity`, `status` |
| `notifications` | One bell notification for one user. | `user_id`, `type`, `title`, `body`, `link`, `is_read` |
| `password_resets` | A pending password-reset token. | `user_id`, `token_hash`, `expires_at`, `used_at` |
| `tasks` | A task assigned to an attachee. | `department_id`, `assigned_to`, `assigned_by`, `title`, `priority`, `due_date`, `status` |
| `reminders` | A personal reminder an attachee set. | `user_id`, `title`, `remind_at`, `is_done` |
| `attachee_checkins` | An attachee's click check-in for a day. | `attachee_id`, `department_id`, `check_in`, `check_out` |
| `inquiries` | A question thread an attachee opened. | `attachee_id`, `department_id`, `subject`, `audience`, `status` |
| `inquiry_messages` | One message inside an inquiry thread. | `inquiry_id`, `sender_id`, `body` |
| `site_settings` | One editable section of the public website (JSON). | `key` (e.g. `hero`), `value` (JSONB) |
| `partners` | A partner organisation on the website. | `name`, `website`, `logo_url`, `logo_storage`, `is_active` |
| `site_media` | An uploaded website image (hero/about). | `key`, `file_url`, `file_storage` |

**Relationships are enforced by foreign keys.** For example, `users.department_id`
references `departments.id`. Most are `ON DELETE RESTRICT` (you can't delete a
department that still has users), while child records like `attendance_records` are
`ON DELETE CASCADE` (deleting a session deletes its records).

**The schema is applied automatically.** On every server boot, `migrate()`:
1. Runs `CREATE EXTENSION IF NOT EXISTS pgcrypto` (needed for `gen_random_uuid()`).
2. Runs `schema.sql` — every statement is `CREATE TABLE IF NOT EXISTS`, so it's safe
   to run repeatedly (this is called being **idempotent**).
3. Runs a few `ALTER TABLE` statements that upgrade older databases (e.g. adding the
   `attachee` role to the allowed list). These are also written to be idempotent.

`seed.js` (run with `npm run seed`) inserts the 9 departments and one default account
per role per department, using `ON CONFLICT DO NOTHING` so re-running never duplicates.

---

## 6. How a request flows end to end

Take "an instructor adds a trainee" as a concrete example.

1. **User action**: the instructor types a name + phone and clicks "Add Trainee".
2. **Frontend**: `TraineesPage.jsx` calls `createTrainee({name, phone})` from
   `client/src/api/trainees.js`, which calls `api.post('/trainees', data)`.
3. **Axios** sends `POST http://<host>/api/trainees` with the JSON body **and the
   auth cookie attached** (because the Axios instance sets `withCredentials: true`).
4. **Nginx** (in production) forwards the `/api` request to the Express server.
5. **Express** matches the route `POST /api/trainees`, which has middleware:
   `verifyToken` → `requireRole('instructor')` → the handler.
   - `verifyToken` reads the cookie, verifies the JWT, sets `req.user`.
   - `requireRole('instructor')` checks `req.user.role === 'instructor'`.
   - The handler validates the inputs, then runs an `INSERT` SQL query, using
     `req.user.department_id` and `req.user.id` (so the trainee is tied to the
     instructor's own department — the client can't choose a different department).
6. **PostgreSQL** stores the row and returns it.
7. **Express** responds `201 Created` with the new trainee as JSON.
8. **Frontend** shows a success toast and refreshes the list.

Every authenticated feature follows this same shape:
`request → verifyToken → requireRole → validate inputs → SQL (scoped) → JSON response`.

---

## 7. Authentication (who are you?)

**Authentication** = proving identity ("you are this user"). It is separate from
**authorization** (section 9), which is about permissions.

### Login

`POST /api/auth/login` (in `server/src/routes/auth.js`):

1. Reads `email` and `password` from the request body.
2. Looks up the user by email (lower-cased, trimmed) with a SQL query that joins the
   department to also get `department_name`.
3. If no user is found, **or** the account is `is_active = false`, it returns
   `401 Invalid credentials`. (Note: the same generic message is used whether the
   email doesn't exist or the password is wrong — this avoids telling an attacker
   which emails are real.)
4. It compares the submitted password to the stored hash with `bcrypt.compare(...)`.
   bcrypt re-hashes the input with the stored salt and checks for a match — the
   original password is never decrypted (it can't be; hashing is one-way).
5. On success it creates a **JWT** (next section) and sets it as an **HttpOnly
   cookie** named `token`.
6. It responds with a safe `user` object (id, name, email, role, department_id,
   department_name) — **never** the password hash.

### Restoring a session

When the frontend loads, it doesn't know who you are yet. `AuthContext.jsx` calls
`GET /api/auth/me` on mount:

- `verifyToken` middleware reads the cookie and verifies it.
- The handler re-queries the database for fresh user details, including the
  department flags `has_trainees` and `has_radio_report` (used for navigation).
- If the cookie is missing/expired/invalid, `/me` returns `401`, and the frontend
  treats you as logged out.

This means a logged-in user who refreshes the page stays logged in (the cookie is
still in the browser), and the app rebuilds its "current user" from `/me`.

### Logout

`POST /api/auth/logout` calls `res.clearCookie('token', ...)`, deleting the cookie.
The frontend then sets the current user to `null` and redirects to `/login`.

### Why the frontend never stores the token

The JavaScript **cannot read** the auth cookie (it's HttpOnly — see next section).
The browser automatically attaches the cookie to every same-site request. So the
frontend's "are we logged in?" knowledge comes purely from whether `/api/auth/me`
succeeds, not from holding a token in JavaScript. This is intentional and more secure.

---

## 8. Cookies & JWT in full detail

### What a JWT is

A **JWT (JSON Web Token)** is a string in three parts separated by dots:

```
header . payload . signature
eyJhbGci... . eyJpZCI6MTUs... . pbiewiOV51XBjP...
```

- **Header** — says the algorithm, here `HS256` (HMAC-SHA256).
- **Payload** — the data ("claims"). In this system the payload is:
  ```json
  {
    "id": 15,
    "name": "Tech Department Supervisor",
    "email": "supervisor.tech@swahilipothub.co.ke",
    "role": "supervisor",
    "department_id": 4,
    "iat": 1780483014,    // issued-at (unix seconds)
    "exp": 1781087814     // expiry (unix seconds) — 7 days later
  }
  ```
- **Signature** — `HMAC_SHA256( base64(header) + "." + base64(payload), JWT_SECRET )`.

> The header and payload are only **Base64-encoded, not encrypted** — anyone can
> decode and read them. The security comes from the **signature**: because it's
> computed with the secret `JWT_SECRET`, nobody can change the payload (e.g. flip
> `role` to `admin`) without invalidating the signature. The server recomputes the
> signature on every request and rejects any token that doesn't match. **Therefore
> the JWT payload must never contain a real secret — only identity claims.**

### How the token is generated

In `auth.js` login:

```js
jwt.sign(
  { id, name, email, role, department_id },   // the payload claims
  process.env.JWT_SECRET,                      // the signing key
  { expiresIn: '7d' }                          // adds iat + exp = now + 7 days
);
```

`JWT_SECRET` is a long random string from the environment (`.env`). It must be at
least 16 characters (enforced by the Zod env validator) — in practice it's a 32-byte
random value. If this secret leaks, anyone could forge tokens, so it is never
committed to git.

### How the token is stored — the cookie

The token is placed in a cookie with these exact options
(`COOKIE_OPTS` in `auth.js`):

| Option | Value | What it means |
|---|---|---|
| name | `token` | The cookie's name. |
| `httpOnly` | `true` | **JavaScript cannot read this cookie.** It exists only for the browser to send back. This blocks token theft via XSS (malicious scripts). |
| `sameSite` | `'lax'` | The cookie is sent on top-level navigations and same-site requests, but **not** on cross-site POSTs from other websites. This mitigates **CSRF** (a malicious site tricking your browser into calling our API). |
| `maxAge` | `604800000` ms = **7 days** | How long the browser keeps the cookie. |
| `secure` | *(not set)* | If set, the cookie would only be sent over HTTPS. It's currently off because the test deployment runs on plain HTTP via an IP address. **On a real HTTPS domain this should be turned on.** |

So there are effectively **two** 7-day clocks that must both be valid:
- the **cookie's** `maxAge` (browser deletes it after 7 days), and
- the **JWT's** `exp` claim (server rejects it after 7 days).

They're set to the same 7 days, so a session lasts up to a week. There is no refresh
mechanism — after 7 days you log in again. There is also no server-side session
store: the JWT is **stateless**, meaning the server keeps no record of issued tokens.
A consequence: "logout" only deletes the cookie in your browser; a stolen token would
remain valid until it expires. (For this internal tool that trade-off is acceptable;
a token blocklist could be added if needed.)

### How the token is verified on each request

`verifyToken` (in `middleware/auth.js`) runs before every protected route:

```js
const token = req.cookies.token;          // read by cookie-parser
if (!token) return 401;
const payload = jwt.verify(token, process.env.JWT_SECRET);  // checks signature + exp
req.user = { id, name, email, role, department_id };        // trust the claims
```

If `jwt.verify` throws (bad signature, expired, malformed), the request gets `401`
and never reaches the handler. If it succeeds, `req.user` is now available to all
downstream code — this is the identity the rest of the request trusts.

---

## 9. Authorization (what are you allowed to do?)

Authorization happens in **three layers**, defence-in-depth:

### Layer 1 — Role check (`requireRole`)

`middleware/requireRole.js` is a **factory** — a function that returns middleware:

```js
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

Used in routes like:

```js
router.post('/trainees', verifyToken, requireRole('instructor'), handler);
router.get('/sessions/:id/records', verifyToken, requireRole('instructor', 'supervisor'), handler);
```

- `verifyToken` must come first (it sets `req.user`).
- `requireRole('instructor')` → only instructors pass; everyone else gets `403 Forbidden`.
- `requireRole('instructor', 'supervisor')` → either role passes.

`401` means "not logged in"; `403` means "logged in but not allowed".

### Layer 2 — Department scoping in SQL

Passing the role check is not enough. A supervisor of department A must not see
department B's data. This is enforced **inside the SQL query itself**, using the
trusted `req.user.department_id`:

```sql
SELECT ... FROM form_submissions
 WHERE department_id = $1          -- $1 = req.user.department_id
```

The client never sends a department id for these operations — it comes from the
verified token. So even a crafted request cannot reach another department's rows.
(See [section 12](#12-department-scoping-the-core-data-isolation-rule).)

### Layer 3 — Ownership / record checks

For actions on a specific record, the query also checks ownership. Example: an
instructor confirming an attendance record can only confirm records belonging to a
session **they** created:

```sql
UPDATE attendance_records r
   SET is_confirmed = true, confirmed_by = $2
  FROM attendance_sessions s
 WHERE r.id = $1 AND r.session_id = s.id AND s.instructor_id = $2
```

If the record isn't theirs, zero rows update and the handler returns `404`.

### A special case — the downtime guard

Downtime reporting is only for the Communication department (the one with
`has_radio_report = true`). `downtime.js` adds a `requireRadioDepartment` middleware
that queries the user's department and returns `403` with a clear message if it isn't
the radio department — another DB-level check, not just a UI hide.

### Frontend authorization (UX only, not security)

The frontend also restricts things — but understand that **frontend checks are only
for user experience, never for security**. Anyone can edit JavaScript or call the API
directly, so the backend re-checks everything.

- `PrivateRoute` (in `routes/PrivateRoute.jsx`): if there's no logged-in user (and
  we're done loading), redirect to `/login`; while loading, show a spinner.
- `RoleRoute` (in `routes/RoleRoute.jsx`): wraps `PrivateRoute` and also checks the
  role, and optionally a department flag (`requireFlag="has_trainees"`). Wrong role →
  redirect to `/dashboard`.

Example from `App.jsx`:

```jsx
<Route path="/trainees" element={
  <RoleRoute roles={['instructor']} requireFlag="has_trainees">
    <TraineesPage />
  </RoleRoute>
} />
```

This means: you must be logged in, be an `instructor`, and your department must have
`has_trainees = true`. The matching backend routes enforce the same thing in SQL.

---

## 10. Roles and their exact permissions

There are four staff roles, stored in `users.role`. A database `CHECK` constraint
only allows these four values.

### `admin` (System Administrator) — global, no department

- `department_id` is **NULL** (admins are not tied to one department).
- Manages **all accounts** across all departments (`/api/admin/...`):
  - List/search/filter every user; view a profile.
  - Create `supervisor`, `instructor`, or `attachee` accounts (any department).
  - Suspend/reactivate any account (cannot suspend their own).
  - Reset any user's password to a new value.
  - Delete an account (blocked with a clear error if it owns records — suspend instead).
- Sees system-wide stats and edits the **public website** (`/api/site/...`).
- **Cannot**: file submissions, take attendance, etc. (those are department features).

### `supervisor` — one department, oversight

- Reviews **department submissions**: acknowledge or return them (with a note).
- Manages **instructors** in their department: add, activate/deactivate.
- Read-only view of **attendance sessions** in their department.
- Resolves **downtime reports** (if Communication department).
- Sees/assigns **attachee tasks**, views **attachee check-ins**, answers **inquiries**.
- Department dashboard: instructor/trainee counts, pending submissions.

### `instructor` — one department, day-to-day

- Manages **trainees** (add, deactivate) — if `has_trainees`.
- Runs **attendance**: generate QR sessions, view & confirm check-ins, rename/delete
  sessions, export weekly/monthly attendance — if `has_trainees`.
- Files **submissions** to their supervisor (optionally with a file).
- Reports **downtime** (if Communication department).
- Assigns **tasks** to attachees, views **attachee check-ins**, answers **inquiries**.

### `attachee` (intern) — one department, self-service

- Sees **tasks** assigned to them; marks progress; submits work.
- **Checks in/out** daily with one click.
- Sets personal **reminders** (with "add to Google Calendar"/`.ics`).
- Opens **inquiries** to instructors/supervisors and reads replies.
- Files **submissions** (e.g. assignment uploads).

**How a permission is "enforced" — to be explicit:** a permission is real only when a
**backend route requires the role and scopes the SQL**. The sidebar simply hides links
a role shouldn't use, and `RoleRoute` redirects, but those are conveniences. The
authoritative gate is always: `verifyToken` → `requireRole(...)` → department/ownership
checks in the SQL.

---

## 11. How a user reaches the correct dashboard

Every logged-in user goes to the **same URL**, `/dashboard`, but sees a **different
screen** based on their role. There is no separate URL per role.

`pages/dashboard/DashboardPage.jsx` reads the current user from `AuthContext` and
branches:

```jsx
const { user } = useAuth();
if (user.role === 'admin')    return <AdminDashboard />;     // system-wide stats
if (user.role === 'attachee') return <AttacheeDashboard />;  // tasks, check-in, reminders
return <StaffDashboard user={user} />;                        // supervisor/instructor
```

Each variant fetches its own data:
- Admin → `GET /api/admin/stats`
- Attachee → `GET /api/attachee/dashboard`
- Supervisor/Instructor → `GET /api/dashboard` (the backend further branches by role)

The **sidebar navigation** is also built per role in `components/layout/Sidebar.jsx`
by a `buildNav(user)` function. For example, an admin sees only "Dashboard / User
Management / Website Content"; an attachee sees "Dashboard / My Tasks / Submissions /
Reminders / Inquiries"; an instructor with `has_radio_report` additionally sees
"Downtime Reports".

So "redirecting to the correct dashboard" is really: **after login the app navigates
to `/dashboard`, and the page + sidebar render themselves according to `user.role`
and the department flags** carried in the user object from `/api/auth/me`.

**The flow after clicking "Sign In"** (in `AuthContext.login`):
1. `POST /api/auth/login` → sets the cookie, returns the basic user.
2. Immediately `GET /api/auth/me` → returns the full user **including** `has_trainees`
   and `has_radio_report` (needed to decide navigation).
3. `setUser(...)` stores it in context, and `LoginPage` calls `navigate('/dashboard')`.

---

## 12. Department scoping (the core data-isolation rule)

This is the single most important security rule in the app:

> **Supervisors and instructors must never see, modify, or act on another
> department's data — and this is enforced in SQL, not just in the UI.**

How it's done in practice:

- The user's department comes from the **verified JWT** (`req.user.department_id`),
  never from the request body or query string for read/write of department data.
- Every relevant query includes `WHERE department_id = $1` (or joins through a table
  that does). Examples: trainees, attendance sessions, submissions, downtime, tasks,
  attachee check-ins, inquiries.
- "Create" operations set `department_id` from `req.user`, so a new row can only be
  created in your own department.
- "Update/delete" operations include the department (and often the owner id) in the
  `WHERE`, so an attempt to touch another department's row simply matches zero rows
  and returns `404`.

The only global role is `admin`, whose endpoints are intentionally cross-department
and live under a separate `/api/admin` prefix guarded by `requireRole('admin')`.

---

## 13. Feature walkthroughs

### Trainee attendance (QR)

1. An instructor clicks "Generate QR Code". `POST /api/attendance/sessions` creates a
   row in `attendance_sessions` with a `token` (a UUID generated **by PostgreSQL**
   via `gen_random_uuid()`) and `expires_at = now + 3 hours`.
2. The frontend renders a QR code (with `qrcode.react`) encoding the URL
   `https://<host>/attend/<token>`. The QR is **persistent**: on refresh the page
   re-derives it from the server's active sessions, so it stays until expiry.
3. A trainee scans it → opens the **public** page `/attend/:token` (no login). They
   enter **name + phone only**; the check-in time is recorded automatically (shown in
   EAT). `POST /api/attend/:token` validates the token isn't expired and inserts an
   `attendance_records` row.
4. The instructor sees check-ins on the session detail page and can "Confirm" each
   (sets `is_confirmed`, `confirmed_by`). Supervisors see the same page read-only.
5. **Weekly/monthly export**: `GET /api/attendance/records-range?period=week|month`
   returns all check-ins across the instructor's sessions in the current EAT week/
   month; the frontend builds a combined attendance sheet PDF (a trainee×day matrix
   for a week, a summary for longer ranges).

### Form submissions

- Instructor/attachee files a submission (`POST /api/submissions`, multipart so it can
  include a file). Status starts at `submitted`. The department's supervisors get a
  notification.
- Supervisor **acknowledges** or **returns** it (return requires a note). The filer
  gets a notification. Files are uploaded to S3/disk; download is **streamed through
  the API** after a department check, so the storage bucket can stay private.

### The attachment (internship) programme

- **Tasks**: a supervisor/instructor assigns a task to an attachee in their
  department. The attachee marks it in-progress / submits work (which can be linked to
  a submission). Staff mark it completed. Each step notifies the other party.
- **Check-ins**: an attachee clicks to check in / out for the day; staff see times.
- **Reminders**: personal to-dos with a date; each can be added to Google Calendar
  (a pre-filled link) or downloaded as a `.ics` file.
- **Inquiries**: an attachee opens a subject + message addressed to instructors,
  supervisors, or both; staff in that department reply in a thread; notifications flow
  both ways.

### Notifications

`notifications` rows are created by `lib/notify.js` whenever something relevant
happens (submission filed/returned, task assigned, inquiry replied, account changed,
etc.). The frontend bell polls `GET /api/notifications/unread-count` periodically and
shows a dropdown; clicking marks them read.

---

## 14. File uploads & storage

Storage is **driver-based** (`server/src/lib/s3.js` + `middleware/upload.js`):

- If `STORAGE_DRIVER=s3` (or S3 credentials are present), files go to **Amazon S3**
  via `multer-s3`, under keys like `submissions/<timestamp>-<random>.pdf`.
- Otherwise files go to **local disk** under `UPLOADS_DIR` (default `./uploads`).
- The chosen driver is recorded per file in `file_storage` (`'s3'` or `'local'`), so
  downloads know where to read from even if the driver later changes.

**Uploads are restricted**: only certain extensions/MIME types (pdf, doc(x), xls(x),
ppt(x), jpg, jpeg, png) and a **10 MB** size limit, enforced by Multer's `fileFilter`
and `limits`.

**Downloads are private**: `GET /api/submissions/:id/file` requires login, checks the
file belongs to your department (or you filed it), then **streams** the bytes through
the server. The S3 bucket is never exposed directly to the browser, so files can't be
fetched by guessing URLs.

On boot, `checkS3()` does a `HeadBucket` call and logs `\[storage] S3 OK ...` or a
precise error, so a misconfigured bucket/region is obvious in the logs.

---

## 15. Email (password reset)

Self-service password reset works without the user being logged in:

1. **Request** — `POST /api/auth/forgot-password` with an email. The server:
   - Always responds with the same generic message ("if that account exists, a link
     was sent") so it never reveals which emails are registered.
   - If the email belongs to an active user, it generates a random token, stores only
     its **SHA-256 hash** in `password_resets` with a **60-minute expiry**, and emails
     a link `…/reset-password?token=<raw token>`.
   - The email is sent **in the background** (fire-and-forget) so the HTTP request
     never hangs if the mail provider is slow. The reset link is also written to the
     server log as a fallback.
2. **Reset** — `POST /api/auth/reset-password` with the token + new password. The
   server hashes the token, finds a matching **unused, unexpired** row, updates the
   user's `password_hash` (bcrypt), and marks the token `used_at` so it can't be
   reused.

**Email delivery** (`lib/mailer.js`) prefers **Brevo's HTTP API** (port 443) because
cloud hosts often block SMTP ports; SMTP is a fallback with short timeouts. All emails
use a branded HTML template (`lib/emailTemplate.js`): a blue header band with the
white logo, a card body, a button, and a footer. `npm run mail:test <email>` sends a
test and prints the provider's exact response for debugging.

> Security note on tokens: storing only the **hash** of the reset token means that
> even if the database leaked, the stored value can't be used to reset a password
> (you'd need the original token, which only existed in the email).

---

## 16. PDF export

"Export PDF" buttons appear on data tables (attendance, trainees, submissions,
instructors, admin users, attachee check-ins, downtime, tasks). They run **in the
browser** using `jspdf` + `jspdf-autotable` (`client/src/lib/pdf.js`):

- Each PDF has the **SwahiliPot logo** header, a title + context labels, an EAT
  "Generated …" timestamp, a brand-blue table, and a page footer.
- The libraries are **lazy-loaded** (dynamic `import()`), so they download only when a
  user actually clicks Export — keeping the initial app small.

Because this is client-side, no server route is involved; the page already has the
data it's displaying.

---

## 17. The public website (CMS)

The marketing landing page at `/` is **public** (no login) and **data-driven**:

- `GET /api/site/content` returns all sections (hero text, the metrics/numbers,
  journey, programs, partners, contact, etc.), merging admin overrides stored in
  `site_settings` over the defaults in `lib/siteDefaults.js`.
- Partner logos and hero/about images are served by **public, no-auth** endpoints that
  stream from S3/disk.
- A **System Admin** edits everything from **Website Content** (`/site`): the numbers,
  text sections, partners (with logo uploads), and hero/about photos. Saving issues
  `PUT /api/site/content/:key` (admin-only) and the public site reflects it instantly.

So the same backend powers both the staff tool and the public website, separated by
the `/api/site` public-vs-admin routes.

---

## 18. Security summary (everything we do)

| Area | Measure |
|---|---|
| **Passwords** | Stored only as **bcrypt** hashes (cost 10, one-way). Never logged, never returned by any endpoint. |
| **Sessions** | Stateless **JWT** in an **HttpOnly** cookie (JS can't read it → XSS-resistant), `SameSite=Lax` (CSRF-resistant), 7-day expiry. |
| **Login** | Generic `Invalid credentials` message (no email enumeration). Inactive accounts can't log in. |
| **Authorization** | `requireRole(...)` on every protected route, plus **department scoping enforced in SQL**, plus ownership checks for record-level actions. |
| **Data isolation** | A department's data is unreachable by another department because the filter uses the trusted `department_id` from the token, not client input. |
| **Sensitive data** | `password_hash` is never selected into any API response. |
| **File access** | Uploads type/size-limited; downloads require auth + department check and are streamed (bucket stays private). |
| **Reset tokens** | Only the **hash** is stored; 60-minute expiry; single-use. |
| **CORS** | The API only accepts browser calls from the configured `CLIENT_URL`, with credentials. |
| **Input validation** | Every mutating route validates required fields and returns `400` with a clear message; SQL uses **parameterised queries** (`$1, $2`) so input can't be injected. |
| **Config safety** | Zod validates env vars at startup and **crashes** if a required one is missing/invalid — no silent misconfiguration. |
| **Error handling** | A global error handler logs server-side but returns generic `500` messages — **stack traces are never sent to clients**. |
| **Secrets** | `.env` is git-ignored; only `.env.example` (placeholders) is committed. |

**Known hardening still recommended** (honest list): turn on the cookie `secure` flag
once running on HTTPS; consider a real domain + TLS; rotate any credentials that were
shared in plaintext; optionally add a token blocklist for instant logout/revocation;
upgrade Multer to 2.x at some point.

---

## 19. Configuration (environment variables)

All backend config lives in `server/.env` (never committed). The Zod schema in
`config/env.js` validates them on boot.

| Variable | Required? | Purpose |
|---|---|---|
| `PORT` | no (default 5000) | Port the API listens on. |
| `DATABASE_URL` | **yes** | PostgreSQL connection string (Neon). |
| `JWT_SECRET` | **yes** (≥16 chars) | Signs/verifies JWTs. |
| `CLIENT_URL` | **yes** (a URL) | The frontend origin — used for CORS and for building reset links/email logo. |
| `STORAGE_DRIVER` | no (`local`/`s3`) | Where uploads go. Auto-detects S3 if creds present. |
| `UPLOADS_DIR` | no (default `./uploads`) | Local upload folder when using disk. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` | only if S3 | S3 storage. `AWS_REGION` must be the bucket's real region. |
| `BREVO_API_KEY` | only for email | Brevo HTTP API key (preferred email path). |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | no | The verified sender address shown on emails. |
| `SMTP_HOST/PORT/USER/PASS/FROM` | no | SMTP fallback if no Brevo key. |

The frontend has one variable, `client/.env` → `VITE_API_URL` (default
`http://localhost:5000/api`); in production it's set to `/api` so the browser calls the
same origin (Nginx then proxies it).

---

## 20. How it runs in production (deployment)

The app is deployed on a Linux VPS (DigitalOcean). The pieces:

```
Internet ──► Nginx (port 80) ──┬── serves client/dist/*  (the built React files)
                               └── proxies /api/*  ──►  Node/Express (PM2, port 5000) ──► Neon (Postgres) + S3
```

- **Nginx** is the public web server. It serves the **built** frontend (`client/dist`,
  produced by `npm run build`) and forwards any request path starting with `/api` to
  the backend on `127.0.0.1:5000`. It also sets `client_max_body_size 12M` so 10 MB
  uploads pass through.
- **PM2** is a process manager that keeps the Node server running, restarts it if it
  crashes, and starts it on reboot. The server runs `npm start` → `node index.js`.
- **Neon** hosts PostgreSQL in the cloud; the server connects over TLS.
- **S3** (region `ap-south-1`) holds uploaded files.
- Because the frontend is served and the API is proxied **from the same origin**
  (the VPS), the auth cookie is same-site and "just works" with `SameSite=Lax`.

**Boot sequence** (`index.js`):
1. `dotenv.config({ override: true })` — load `.env` (override:true so edits always win).
2. `loadEnv()` — Zod validation; crash if misconfigured.
3. `migrate()` — ensure all tables exist (with a retry, because Neon's serverless
   Postgres can be briefly asleep on the first connection).
4. `checkS3()` and `logMailConfig()` — log storage + email status for diagnostics.
5. `app.listen(PORT)`.

**A typical redeploy:**
```bash
cd ~/Swahili-Pot-Project && git fetch origin && git reset --hard origin/main
cd server && npm ci && pm2 restart sph-api --update-env
cd ../client && npm run build
```

---

## 21. Glossary

- **API** — a set of URLs the backend exposes that return data (JSON), not web pages.
- **REST** — a convention for API URLs (`GET` to read, `POST` to create, `PATCH` to
  update, `DELETE` to remove).
- **SPA (Single-Page Application)** — a website that loads once and then re-renders in
  the browser as you navigate, fetching data via the API.
- **Middleware** — a function that runs before a route handler (e.g. to check auth).
- **JWT** — a signed token proving identity; see [section 8](#8-cookies--jwt-in-full-detail).
- **Hashing** — a one-way transformation; you can verify a value but not reverse it
  (used for passwords and reset tokens).
- **bcrypt** — the specific password-hashing algorithm used.
- **HttpOnly cookie** — a cookie the browser stores and sends but JavaScript can't read.
- **CORS** — browser rules controlling which sites may call an API.
- **CSRF** — an attack where another site makes your browser call our API; mitigated by
  `SameSite` cookies.
- **XSS** — an attack injecting malicious JS into a page; mitigated by HttpOnly cookies
  and React's escaping.
- **Idempotent** — an operation safe to run many times with the same result (our
  migrations and seeds).
- **Parameterised query** — SQL where values are passed separately (`$1`) so user input
  can't be interpreted as SQL (prevents SQL injection).
- **EAT** — East Africa Time (UTC+3); all times are displayed in EAT.
- **Department scoping** — restricting data access to the user's own department.
- **Pool** — a set of reusable database connections shared by all requests.
```
