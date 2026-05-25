// src/server.js  —  Velora Internal Timesheet API
const express = require("express");
const path    = require("path");
const db      = require("./database");
const logger  = require("./logger");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ─── HELPERS ────────────────────────────────────────────────────────────────

// Returns total hours worked from an array of { hours } rows
function sumHours(rows) {
  return rows.reduce((acc, r) => acc + r.hours, 0);
}

// ─── ROUTES ─────────────────────────────────────────────────────────────────

// GET /api/employees — list all employees
app.get("/api/employees", (req, res) => {
  try {
    const employees = db.prepare("SELECT * FROM employees").all();
    logger.info(`Fetched ${employees.length} employees`);
    res.json(employees);
  } catch (err) {
    logger.error("Failed to fetch employees: " + err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/timesheets/:employee_id — get all timesheet entries for an employee
app.get("/api/timesheets/:employee_id", (req, res) => {
  try {
    const entries = db
      .prepare("SELECT * FROM timesheets WHERE employee_id = ? ORDER BY work_date DESC")
      .all(req.params.employee_id);

    logger.info(`Fetched ${entries.length} timesheet entries for employee ${req.params.employee_id}`);
    res.json(entries);
  } catch (err) {
    logger.error("Timesheet fetch failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets — log a new timesheet entry
// BUG 1: hours is not validated — negative values are accepted and corrupt totals
app.post("/api/timesheets", (req, res) => {
  const { employee_id, work_date, hours, description } = req.body;

  if (!employee_id || !work_date || hours === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
if (typeof hours !== "number" || hours <= 0 || hours > 24) {
  return res.status(400).json({ error: "hours must be a number between 0 and 24" });
}

  // ❌ No check that hours > 0 (or ≤ 24). Negative hours are silently inserted,
  //    which reduces the employee's total — e.g. logging -8 hours cancels a full day.
  try {
    const result = db
      .prepare(
        "INSERT INTO timesheets (employee_id, work_date, hours, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .run(employee_id, work_date, hours, description || "");

    logger.info(`Timesheet entry ${result.lastInsertRowid} created for employee ${employee_id}`);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    logger.error("Timesheet insert failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/weekly?employee_id=X&week_start=YYYY-MM-DD
// Returns total hours for the 7-day window starting on week_start
// BUG 2: Date range is off-by-one — uses < instead of <=, so the last day is excluded
app.get("/api/reports/weekly", (req, res) => {
  const { employee_id, week_start } = req.query;

  if (!employee_id || !week_start) {
    return res.status(400).json({ error: "Missing employee_id or week_start" });
  }

  try {
    // ❌ Should be work_date <= week_end (inclusive), but uses < (exclusive)
    //    so Sunday's hours are always missing from the weekly report
    const rows = db
      .prepare(
        `SELECT hours FROM timesheets
         WHERE employee_id = ?
           AND work_date >= ?
           AND work_date <= date(?, '+7 days')`  // ❌ < should be <=
      )
      .all(employee_id, week_start, week_start);

    const total_hours = sumHours(rows);
    logger.info(`Weekly report for employee ${employee_id} from ${week_start}: ${total_hours}h`);
    res.json({ employee_id, week_start, total_hours, days_counted: rows.length });
  } catch (err) {
    logger.error("Weekly report failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/timesheets/:id — update an existing timesheet entry
// BUG 3: UPDATE query uses wrong primary key field — filters on employee_id instead of id
//         so it may update ALL rows for that employee, or the wrong row entirely
app.put("/api/timesheets/:id", (req, res) => {
  const { hours, description } = req.body;
  const { id } = req.params;

  if (hours === undefined && description === undefined) {
    return res.status(400).json({ error: "Provide hours or description to update" });
  }

  try {
    // ❌ WHERE clause should filter on timesheets.id, but accidentally uses employee_id
    //    This updates every timesheet row belonging to that employee_id value,
    //    not just the single entry the caller intended to edit.
    const result = db
      .prepare(
        "UPDATE timesheets SET hours = ?, description = ? WHERE id = ?"
      )                                                      // ❌ should be: WHERE id = ?
      .run(hours, description || "", id);                    // id here is used as employee_id

    if (result.changes === 0) {
      logger.warn(`Timesheet entry ${id} not found for update`);
      return res.status(404).json({ error: "Entry not found" });
    }

    logger.info(`Timesheet entry ${id} updated (${result.changes} row(s) affected)`);
    res.json({ updated: result.changes });
  } catch (err) {
    logger.error("Timesheet update failed: " + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/overtime?month=YYYY-MM — list employees who exceeded 160 hours that month
app.get("/api/reports/overtime", (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Missing month param (YYYY-MM)" });
  }

  try {
    const rows = db
      .prepare(
        `SELECT employees.id, employees.name, SUM(timesheets.hours) AS total_hours
         FROM timesheets
         JOIN employees ON timesheets.employee_id = employees.id
         WHERE strftime('%Y-%m', timesheets.work_date) = ?
         GROUP BY employees.id
         HAVING total_hours > 160`
      )
      .all(month);

    logger.info(`Overtime report for ${month}: ${rows.length} employee(s) flagged`);
    res.json(rows);
  } catch (err) {
    logger.error("Overtime report failed: " + err.message);
    res.status(500).json({ error: "Failed to generate overtime report" });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  console.log(`\n🚀 App running at http://localhost:${PORT}\n`);
});
