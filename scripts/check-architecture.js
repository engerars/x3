const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const mainAppPath = path.join(rootDir, "assets", "js", "modules", "main-app.js");

function fail(message) {
  console.error(`[ARCH-CHECK] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(mainAppPath)) {
  fail(`Cannot find main app file: ${mainAppPath}`);
}

const source = fs.readFileSync(mainAppPath, "utf8");
const forbiddenPattern = /databaseService\.db\./g;
const matches = [...source.matchAll(forbiddenPattern)];

if (matches.length > 0) {
  const lines = source.split(/\r?\n/);
  const offenderLines = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextOffset = offset + line.length + 1;
    const hasMatch = matches.some((m) => m.index >= offset && m.index < nextOffset);
    if (hasMatch) offenderLines.push(i + 1);
    offset = nextOffset;
  }

  fail(
    `main-app.js must not access database directly. Found ${matches.length} violation(s) at line(s): ${offenderLines.join(", ")}`
  );
}

console.log("[ARCH-CHECK] OK: main-app.js has no direct database access.");
