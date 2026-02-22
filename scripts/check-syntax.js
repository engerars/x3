const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const modulesDir = path.join(rootDir, "assets", "js", "modules");

function listJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    stdio: "pipe",
    encoding: "utf8",
  });
  return result;
}

if (!fs.existsSync(modulesDir)) {
  console.error(`[SYNTAX-CHECK] Modules directory not found: ${modulesDir}`);
  process.exit(1);
}

const files = listJsFiles(modulesDir);
const failures = [];

for (const filePath of files) {
  const res = runNodeCheck(filePath);
  if (res.status !== 0) {
    failures.push({
      filePath,
      stderr: (res.stderr || "").trim(),
      stdout: (res.stdout || "").trim(),
    });
  }
}

if (failures.length > 0) {
  console.error(`[SYNTAX-CHECK] Failed on ${failures.length} file(s):`);
  for (const f of failures) {
    console.error(`- ${path.relative(rootDir, f.filePath)}`);
    if (f.stderr) console.error(f.stderr);
    if (f.stdout) console.error(f.stdout);
  }
  process.exit(1);
}

console.log(`[SYNTAX-CHECK] OK: ${files.length} JS file(s) passed.`);
