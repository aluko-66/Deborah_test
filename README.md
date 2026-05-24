# Velora TSE — Practical Debugging Exercise #3

An internal timesheet tracking API built with Node.js + SQLite. Contains **3 new bugs** to find and fix.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Seed the database (run once)
node db/seed.js

# 3. Start the server
npm start
# → http://localhost:3000
```

---

## The Scenario

> **Support ticket from the Payroll team:**
>
> *"Someone submitted a timesheet with negative hours and it's now dragging down our weekly totals. Also, our weekly reports are consistently short by a few hours — we think the last day of the week isn't being counted. And when an engineer tried to correct a single timesheet entry, it overwrote ALL of their entries with the same value. Payroll is a mess."*

Your job:
1. Reproduce each issue using the browser UI at `http://localhost:3000`
2. Read the logs and code to pinpoint the root cause
3. Describe or implement a fix for each bug

---

## What's Available

| Path | Description |
|------|-------------|
| `src/server.js` | All route handlers |
| `src/database.js` | SQLite connection |
| `src/logger.js` | File-based logger |
| `db/seed.js` | Seeds employees + timesheet data |
| `db/velora3.db` | SQLite database (created after seeding) |
| `logs/app.log` | Application logs |
| `public/index.html` | Browser UI |

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/employees` | List all employees |
| GET | `/api/timesheets/:employee_id` | Get all entries for an employee |
| POST | `/api/timesheets` | Log a new timesheet entry |
| PUT | `/api/timesheets/:id` | Update a single entry |
| GET | `/api/reports/weekly?employee_id=X&week_start=YYYY-MM-DD` | Weekly hours report |
| GET | `/api/reports/overtime?month=YYYY-MM` | Employees who exceeded 160 hrs |

---

## Bugs Hidden in This App

<details>
<summary>🔍 Spoilers — only open after you've investigated!</summary>

### Bug 1 — No validation on `hours` → negative values accepted (`POST /api/timesheets`)

**File:** `src/server.js` line ~43  
**Root cause:** The route accepts any numeric value for `hours` without checking it is positive
(or within a sensible range like 0–24). Posting `-8` hours is silently stored and reduces
weekly/monthly totals, corrupting payroll data.

**Fix:**
```js
// Add after the existing required-fields check:
if (typeof hours !== "number" || hours <= 0 || hours > 24) {
  return res.status(400).json({ error: "hours must be a number between 0 and 24" });
}
```

---

### Bug 2 — Off-by-one date boundary → last day of week excluded (`GET /api/reports/weekly`)

**File:** `src/server.js` line ~74  
**Root cause:** The SQL range condition uses strict `<` (less-than) instead of `<=` (less-than-or-equal).
`work_date < date(week_start, '+7 days')` excludes the 7th day (Sunday if starting Monday).
Grace's 3 Sunday hours never appear in her weekly total — confirmed by the log always showing
`41.5h` instead of the correct `44.5h`.

**Fix:**
```sql
-- Change:
AND work_date < date(?, '+7 days')
-- To:
AND work_date <= date(?, '+6 days')
-- ('+6 days' from Monday gives Sunday inclusive)
```

---

### Bug 3 — Wrong WHERE column in UPDATE → overwrites all entries for an employee (`PUT /api/timesheets/:id`)

**File:** `src/server.js` line ~103  
**Root cause:** The UPDATE query filters on `WHERE employee_id = ?` and passes `req.params.id`
(the timesheet row ID) as that value. Since `id` happens to equal a valid `employee_id`,
every single timesheet row for that employee gets overwritten.  
The log entry `Timesheet entry 3 updated (7 row(s) affected)` is the smoking gun — a single-row
update should never affect 7 rows.

**Fix:**
```js
// Change the SQL:
"UPDATE timesheets SET hours = ?, description = ? WHERE employee_id = ?"
// To:
"UPDATE timesheets SET hours = ?, description = ? WHERE id = ?"
// The .run() arguments are already correct (id is passed last), so only the SQL needs changing.
```

</details>
