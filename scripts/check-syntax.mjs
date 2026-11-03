import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "api", "config", "test", "scripts"];
const files = [];
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (extname(entry.name) === ".js" || extname(entry.name) === ".mjs") files.push(full);
  }
}
for (const dir of roots) await walk(dir);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
