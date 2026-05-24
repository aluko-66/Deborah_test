// src/logger.js
const fs   = require("fs");
const path = require("path");

const logFile = path.join(__dirname, "../logs/app.log");

function timestamp() { return new Date().toISOString(); }

function write(level, message) {
  const line = `[${timestamp()}] [${level}] ${message}\n`;
  fs.appendFileSync(logFile, line);
  if (level === "ERROR") process.stderr.write(line);
}

module.exports = {
  info:  (msg) => write("INFO",  msg),
  warn:  (msg) => write("WARN",  msg),
  error: (msg) => write("ERROR", msg),
};
