/**
 * Coherence checks on the range data.
 *
 * None of these prove the ranges are optimal - nothing here could. What they
 * catch is a chart that contradicts itself or contradicts position, which is
 * the difference between a baseline worth drilling and one that teaches
 * nonsense.
 *
 * A check with no data to run against reports as SKIP, never as a pass, so a
 * half-filled ranges.js can never read as a clean bill of health.
 */

const {
  RANKS, SEATS, TESTED_SEATS, FACING, OPTIONS, RNG_ORDER, RANGES, SPOTS, combosOf,
} = require("./ranges.js");

let failures = 0;
let skipped = 0;
const fail = (m) => { console.log("  FAIL " + m); failures++; };
const skip = (m) => { console.log("  skip " + m); skipped++; };

const ALL_HANDS = new Set();
for (let i = 0; i < 13; i++) {
  for (let j = 0; j < 13; j++) {
    if (i === j) ALL_HANDS.add(RANKS[i] + RANKS[i]);
    else if (i > j) {
      ALL_HANDS.add(RANKS[i] + RANKS[j] + "s");
      ALL_HANDS.add(RANKS[i] + RANKS[j] + "o");
    }
  }
}

const spot = (seat, facing) => SPOTS.find((s) => s.seat === seat && s.facing === facing);
/** Share of hands not folded, mixed frequencies included. */
const played = (s) => OPTIONS.filter((a) => a !== "fold").reduce((t, a) => t + (s.pct[a] || 0), 0);
const weightOf = (s, hand, action) => (s.weights[hand] || {})[action] || 0;

console.log("1. every hand named is a real starting hand");
for (const s of SPOTS) {
  for (const hand of Object.keys(s.weights)) {
    if (!ALL_HANDS.has(hand)) fail(`${s.id} names ${hand}`);
  }
}

console.log("2. every hand's frequencies are percentages that do not overfill it");
for (const s of SPOTS) {
  for (const hand of Object.keys(s.weights)) {
    const spread = s.weights[hand];
    let total = 0;
    for (const action of Object.keys(spread)) {
      const pct = spread[action];
      if (!OPTIONS.includes(action)) fail(`${s.id} ${hand} has an unknown action ${action}`);
      if (!(pct > 0 && pct <= 100)) fail(`${s.id} ${hand} ${action} is ${pct}%`);
      total += pct;
    }
    if (total > 100.0001) fail(`${s.id} ${hand} is played ${total}% of the time`);
    if (total <= 0) fail(`${s.id} ${hand} is listed but never played`);
  }
}

console.log("3. the 1-100 bands cover every roll exactly once");
for (const s of SPOTS) {
  for (const hand of Object.keys(s.bands)) {
    const bands = s.bands[hand];
    if (!bands.length) { fail(`${s.id} ${hand} has no bands`); continue; }
    if (bands[0].lo !== 1) fail(`${s.id} ${hand} starts at ${bands[0].lo}, not 1`);
    if (bands[bands.length - 1].hi !== 100) fail(`${s.id} ${hand} ends at ${bands[bands.length - 1].hi}, not 100`);
    for (let i = 1; i < bands.length; i++) {
      if (bands[i].lo !== bands[i - 1].hi + 1) {
        fail(`${s.id} ${hand} jumps from ${bands[i - 1].hi} to ${bands[i].lo}`);
      }
    }
    // Order matters: the player reads the roll against fold / call / raise.
    const order = bands.map((b) => RNG_ORDER.indexOf(b.action));
    for (let i = 1; i < order.length; i++) {
      if (order[i] <= order[i - 1]) fail(`${s.id} ${hand} bands are out of order`);
    }
  }
}

console.log("4. no spot plays more than every hand");
for (const s of SPOTS) {
  if (played(s) > 100.0001) fail(`${s.id} plays ${played(s).toFixed(1)}% of hands`);
}

console.log("5. aces are never folded and are mostly raised");
for (const s of SPOTS) {
  const raise = weightOf(s, "AA", "raise");
  if (raise < 50) fail(`${s.id} raises AA only ${raise}% of the time`);
}

console.log("6. only the seats being tested have ranges");
for (const seat of Object.keys(RANGES)) {
  if (!SEATS.includes(seat)) fail(`${seat} is not a seat at this table`);
  else if (!TESTED_SEATS.includes(seat)) fail(`${seat} has ranges but is not in TESTED_SEATS`);
}

console.log("7. the big blind has no RFI range");
// It can never be folded to preflop - there is nobody left to act behind it.
if (spot("BB", "rfi")) fail("BB has an RFI range, which cannot happen");

console.log("8. the first seat to act cannot face an open unless it limps");
// This applies to the FIRST seat only. Everyone behind it faces an open the
// ordinary way - someone ahead of them raised - with no limp needed. Getting
// this wrong would have called every later seat's facing-an-open range
// impossible.
{
  const first = SEATS[0];
  const rfi = spot(first, "rfi");
  const open = spot(first, "open");
  if (!rfi) skip(`${first} has no RFI range to judge this against`);
  else if (!(rfi.pct.call > 0) && open) {
    fail(`${first} acts first and is raise-or-fold when folded to, so it cannot face an open, but has an open range`);
  }
}

console.log("9. opening ranges widen from under the gun to the button");
const OPEN_ORDER = TESTED_SEATS.filter((s) => s !== "BB");
let compared = 0;
for (let i = 1; i < OPEN_ORDER.length; i++) {
  const prev = spot(OPEN_ORDER[i - 1], "rfi");
  const here = spot(OPEN_ORDER[i], "rfi");
  if (!prev || !here) continue;
  compared += 1;
  if (played(here) <= played(prev)) {
    fail(`${OPEN_ORDER[i]} opens ${played(here).toFixed(1)}%, not wider than ${OPEN_ORDER[i - 1]} at ${played(prev).toFixed(1)}%`);
  }
  // Nesting: a hand good enough to open early is good enough to open later.
  for (const hand of Object.keys(prev.weights)) {
    const before = weightOf(prev, hand, "raise");
    const after = weightOf(here, hand, "raise");
    if (before > 0 && after < before) {
      fail(`${OPEN_ORDER[i]} raises ${hand} ${after}% but ${OPEN_ORDER[i - 1]} raises it ${before}%`);
    }
  }
}
if (!compared) skip("fewer than two seats have opening ranges");

console.log("10. facing a 4-bet you continue tighter than facing a 3-bet");
let pairs = 0;
for (const seat of TESTED_SEATS) {
  const three = spot(seat, "threebet");
  const four = spot(seat, "fourbet");
  if (!three || !four) continue;
  pairs += 1;
  if (played(four) >= played(three)) {
    fail(`${seat} continues ${played(four).toFixed(1)}% against a 4-bet but ${played(three).toFixed(1)}% against a 3-bet`);
  }
}
if (!pairs) skip("no seat has both a 3-bet and a 4-bet range");

console.log("11. facing a 4-bet, almost everything folds");
for (const s of SPOTS.filter((x) => x.facing === "fourbet")) {
  if (played(s) > 8) fail(`${s.id} continues ${played(s).toFixed(1)}%, which is far too wide`);
}

console.log("12. trash never opens from a seat that is not the button or a blind");
for (const s of SPOTS.filter((x) => x.facing === "rfi")) {
  if (s.seat === "BTN" || s.seat === "SB") continue;
  for (const hand of ["72o", "83o", "94o", "32o", "T2o"]) {
    if (weightOf(s, hand, "raise")) fail(`${s.id} raises ${hand}`);
  }
}

// ---------------------------------------------------------------------------

console.log("\n--- every spot ---");
console.log("spot            raise%   call%   check%   fold%   mixed hands");
for (const s of SPOTS) {
  const col = (v) => (v || 0).toFixed(1);
  console.log(
    s.id.padEnd(15),
    col(s.pct.raise).padStart(6),
    col(s.pct.call).padStart(7),
    col(s.pct.check).padStart(8),
    col(s.pct.fold).padStart(7),
    String(s.mixedCount).padStart(13),
  );
}

const mixed = SPOTS.flatMap((s) =>
  Object.keys(s.bands).filter((h) => s.bands[h].length > 1).map((h) => ({ s, h })),
);
if (mixed.length) {
  console.log("\n--- hands played more than one way ---");
  console.log("spot            hand    frequencies                   roll");
  for (const { s, h } of mixed) {
    const freqs = s.bands[h].map((b) => `${b.action} ${b.hi - b.lo + 1}%`).join(", ");
    const rolls = s.bands[h].map((b) => `${b.lo}-${b.hi} ${b.action}`).join(", ");
    console.log(s.id.padEnd(15), h.padEnd(6), freqs.padEnd(29), rolls);
  }
}

// Some seat/facing pairs cannot happen and should never be listed as missing:
// the big blind is never folded to, and a seat that is raise-or-fold when
// folded to can never end up facing an open.
function impossible(seat, facing) {
  if (seat === "BB" && facing === "rfi") return true;
  // Only the first seat to act needs to have limped to end up facing an open.
  if (facing !== "open" || seat !== SEATS[0]) return false;
  const rfi = spot(seat, "rfi");
  return Boolean(rfi) && !(rfi.pct.call > 0);
}

const missing = [];
const cannot = [];
for (const seat of TESTED_SEATS) {
  for (const facing of Object.keys(FACING)) {
    if (spot(seat, facing)) continue;
    (impossible(seat, facing) ? cannot : missing).push(`${seat}/${facing}`);
  }
}
if (cannot.length) console.log(`\nCannot happen (${cannot.length}): ${cannot.join(", ")}`);
if (missing.length) console.log(`Not written yet (${missing.length}): ${missing.join(", ")}`);

console.log(`\n${SPOTS.length} spot${SPOTS.length === 1 ? "" : "s"}` + (skipped ? `, ${skipped} check(s) skipped for want of data.` : "."));
if (SPOTS.length === 0) console.log("ranges.js is empty - nothing to check yet.");
else console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
