/**
 * Sanity checks on the range data. These are properties any coherent set of
 * opening ranges must have — a chart that violates them would teach something
 * wrong, and that is worth catching before it reaches the trainer.
 */

const { RANGES, RANKS, combosOf } = require("./ranges.js");

let failures = 0;
const fail = (message) => {
  console.log("  FAIL " + message);
  failures++;
};

// Every hand must be one of the 169 real starting hands.
const valid = new Set();
for (let i = 0; i < 13; i++) {
  for (let j = 0; j < 13; j++) {
    if (i === j) valid.add(RANKS[i] + RANKS[i]);
    else if (i > j) {
      valid.add(RANKS[i] + RANKS[j] + "s");
      valid.add(RANKS[i] + RANKS[j] + "o");
    }
  }
}

console.log("1. every hand is a real starting hand");
for (const r of RANGES) {
  for (const hand of r.hands) if (!valid.has(hand)) fail(`${r.label} contains ${hand}`);
}

console.log("2. ranges widen from early position to the button");
const openers = RANGES.filter((r) => r.id !== "SB");
for (let i = 1; i < openers.length; i++) {
  if (openers[i].percent <= openers[i - 1].percent) {
    fail(
      `${openers[i].label} (${openers[i].percent.toFixed(1)}%) is not wider than ` +
        `${openers[i - 1].label} (${openers[i - 1].percent.toFixed(1)}%)`,
    );
  }
}

console.log("3. a hand opened from early position is still opened later");
for (let i = 1; i < openers.length; i++) {
  const missing = [...openers[i - 1].hands].filter((h) => !openers[i].hands.has(h));
  if (missing.length) {
    fail(`${openers[i].label} drops ${missing.join(", ")} which ${openers[i - 1].label} opens`);
  }
}

console.log("4. the small blind opens tighter than the button, and is nested in it");
const btn = RANGES.find((r) => r.id === "BTN");
const sb = RANGES.find((r) => r.id === "SB");
if (sb.percent >= btn.percent) fail(`SB (${sb.percent.toFixed(1)}%) is not tighter than BTN`);
const sbExtra = [...sb.hands].filter((h) => !btn.hands.has(h));
if (sbExtra.length) fail(`SB opens ${sbExtra.join(", ")} which BTN folds`);

console.log("5. premium hands are opened from every position");
for (const r of RANGES) {
  for (const hand of ["AA", "KK", "QQ", "AKs", "AKo"]) {
    if (!r.hands.has(hand)) fail(`${r.label} does not open ${hand}`);
  }
}

console.log("6. trash is never opened from a non-blind, non-button seat");
for (const r of RANGES) {
  if (r.id === "BTN" || r.id === "SB") continue;
  for (const hand of ["72o", "83o", "94o", "32o", "T2o"]) {
    if (r.hands.has(hand)) fail(`${r.label} opens ${hand}`);
  }
}

console.log("\nposition   %hands   combos   hands");
for (const r of RANGES) {
  let combos = 0;
  for (const h of r.hands) combos += combosOf(h);
  console.log(
    r.label.padEnd(9),
    r.percent.toFixed(1).padStart(6),
    String(combos).padStart(8),
    String(r.hands.size).padStart(7),
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
