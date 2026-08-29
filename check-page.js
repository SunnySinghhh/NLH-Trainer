/**
 * Guards against the range data in the page drifting from the range data that
 * check-ranges.js validates. They are written in two places — the Node module
 * and the standalone page — and a silent mismatch would mean the trainer drills
 * something nobody checked.
 */

const fs = require("fs");
const { RANGES } = require("./ranges.js");

const html = fs.readFileSync(`${__dirname}/trainer.src.html`, "utf8");

let failures = 0;
const fail = (m) => { console.log("  FAIL " + m); failures++; };

// Pull each { id: "...", ... notation: [...] } block out of the page source.
const found = new Map();
const re = /\{\s*id:\s*"([A-Z0-9]+)",[\s\S]*?notation:\s*\[([\s\S]*?)\]\s*\}/g;
let match;
while ((match = re.exec(html)) !== null) {
  const tokens = match[2]
    .split(",")
    .map((t) => t.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  found.set(match[1], tokens);
}

console.log(`found ${found.size} position blocks in the page`);
if (found.size !== RANGES.length) fail(`page has ${found.size} positions, module has ${RANGES.length}`);

for (const r of RANGES) {
  const pageTokens = found.get(r.id);
  if (!pageTokens) { fail(`page is missing ${r.id}`); continue; }
  const mine = r.notation.join(",");
  const theirs = pageTokens.join(",");
  if (mine !== theirs) {
    fail(`${r.id} differs\n    module: ${mine}\n    page:   ${theirs}`);
  }
}

// The page must also be pure ASCII by the time it ships, so no charset
// assumption can ever mangle the suit symbols.
const built = `${__dirname}/trainer.html`;
if (fs.existsSync(built)) {
  const out = fs.readFileSync(built, "utf8");
  const nonAscii = [...new Set([...out].filter((c) => c.charCodeAt(0) > 127))];
  if (nonAscii.length) fail(`built page has non-ASCII characters: ${nonAscii.join(" ")}`);
  else console.log("built page is pure ASCII");
}

console.log(failures === 0 ? "\nPage matches the validated ranges." : `\n${failures} mismatch(es).`);
process.exit(failures === 0 ? 0 : 1);
