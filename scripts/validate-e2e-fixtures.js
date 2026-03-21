const { existsSync, readFileSync, statSync } = require("fs");
const { resolve } = require("path");

const ROOT = resolve(__dirname, "..");
let failed = false;

function check(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
    failed = true;
  }
}

function parseJson(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`File not found: ${relPath}`);
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    throw new Error(`Invalid JSON: ${relPath}`);
  }
}

function assertNonEmpty(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) throw new Error(`File not found: ${relPath}`);
  if (statSync(abs).size === 0) throw new Error(`File is empty: ${relPath}`);
}

console.log("Fixture JSON integrity:");
check("app.json is valid JSON", () =>
  parseJson("e2e/fixtures/test-vault/.obsidian/app.json")
);
check(
  "community-plugins.json is valid JSON and contains required plugins",
  () => {
    const plugins = parseJson(
      "e2e/fixtures/test-vault/.obsidian/community-plugins.json"
    );
    for (const id of ["dataview", "project-manager"]) {
      if (!plugins.includes(id)) throw new Error(`Missing plugin: ${id}`);
    }
  }
);
check("project-manager manifest.json has required fields", () => {
  const m = parseJson(
    "e2e/fixtures/test-vault/.obsidian/plugins/project-manager/manifest.json"
  );
  for (const field of ["id", "name", "version", "minAppVersion"]) {
    if (!m[field]) throw new Error(`Missing field: ${field}`);
  }
});

console.log("\nDataview cache presence:");
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  check(`${f} exists and is non-empty`, () =>
    assertNonEmpty(`e2e/fixtures/.dataview-cache/${f}`)
  );
}

if (failed) {
  console.error("\nValidation failed.");
  process.exit(1);
}
console.log("\nAll checks passed.");
