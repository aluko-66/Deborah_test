// db/seed.js — run once: node db/seed.js
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "velora3.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    department TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS timesheets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    work_date   TEXT    NOT NULL,
    hours       REAL    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Employees
const ins = db.prepare("INSERT OR IGNORE INTO employees (name, email, department) VALUES (?, ?, ?)");
ins.run("Grace Hopper",  "grace@velora.io",  "Engineering");
ins.run("Alan Turing",   "alan@velora.io",   "Engineering");
ins.run("Ada Lovelace",  "ada@velora.io",    "Product");
ins.run("Linus Torvalds","linus@velora.io",  "Engineering");

// Timesheets — May 2025, spread across multiple weeks
const ts = db.prepare(
  "INSERT INTO timesheets (employee_id, work_date, hours, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
);

// Grace – week of 2025-05-12 (Mon–Sun)
ts.run(1, "2025-05-12", 8,   "Sprint planning");
ts.run(1, "2025-05-13", 7.5, "API development");
ts.run(1, "2025-05-14", 8,   "Code review");
ts.run(1, "2025-05-15", 8,   "Bug fixes");
ts.run(1, "2025-05-16", 6,   "Docs");
ts.run(1, "2025-05-17", 4,   "On-call");
ts.run(1, "2025-05-18", 3,   "On-call weekend"); // ← Sunday — excluded by Bug 2

// Alan – same week
ts.run(2, "2025-05-12", 8,   "Database design");
ts.run(2, "2025-05-13", 8,   "Schema migration");
ts.run(2, "2025-05-14", 7,   "Testing");
ts.run(2, "2025-05-15", 8,   "Deploy");
ts.run(2, "2025-05-16", 8,   "Monitoring");

// Ada – shorter week
ts.run(3, "2025-05-13", 6,   "Roadmap planning");
ts.run(3, "2025-05-14", 5,   "Stakeholder meeting");
ts.run(3, "2025-05-15", 7,   "Feature spec");

// Linus – overtime month (to test /api/reports/overtime)
for (let d = 1; d <= 22; d++) {
  const day = String(d).padStart(2, "0");
  ts.run(4, `2025-05-${day}`, 8, `Day ${d} work`);
}

console.log("✅ Database seeded successfully.");
db.close();
