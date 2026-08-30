/**
 * Coherence checks on the range data.
 *
 * None of these prove the ranges are optimal — nothing here could. What they
 * catch is a chart that contradicts itself or contradicts position, which is
 * the difference between a baseline worth drilling and one that teaches
 * nonsense.
 */

const { RANKS, SPOTS, combosOf, percentOf } = require("./ranges.js");

let failures = 0;
const fail = (m) => { console.log("  FAIL " + m); failures++; };

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

const spot = (id) => SPOTS.find((s) => s.id === id);
const pct = (s, key) => (s.sets[key] ? percentOf(s.sets[key]) : 0);
/** Everything that is not a fold. */
const played = (s) =>
  Object.keys(s.sets).reduce((total, key) => total + pct(s, key), 0);

console.log("1. every hand named is a real starting hand");
for (const s of SPOTS) {
  for (const key of Object.keys(s.sets)) {
    for (const hand of s.sets[key]) {
      if (!ALL_HANDS.has(hand)) fail(`${s.id} ${key} contains ${hand}`);
    }
  }
}

console.log("2. no hand is assigned two different actions in the same spot");
for (const s of SPOTS) {
  const keys = Object.keys(s.sets);
  for (let a = 0; a < keys.length; a++) {
    for (let b = a + 1; b < keys.length; b++) {
      const overlap = [...s.sets[keys[a]]].filter((h) => s.sets[keys[b]].has(h));
      if (overlap.length) {
        fail(`${s.id} has ${overlap.join(", ")} in both ${keys[a]} and ${keys[b]}`);
      }
    }
  }
}

console.log("3. no spot plays more than every hand");
for (const s of SPOTS) {
  if (played(s) > 100.0001) fail(`${s.id} plays ${played(s).toFixed(1)}% of hands`);
}

const AGGRESSIVE = ["raise", "threebet", "fourbet", "fivebet", "squeeze"];
const aggressiveSet = (s) => s.sets[AGGRESSIVE.find((k) => s.sets[k])];

console.log("4. aces and kings always go in for a raise, never just a call");
for (const s of SPOTS) {
  for (const hand of ["AA", "KK"]) {
    if (!aggressiveSet(s).has(hand)) fail(`${s.id} does not raise ${hand}`);
  }
}

console.log("5. opening ranges widen from under the gun to the button");
const OPEN_ORDER = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"];
for (let i = 1; i < OPEN_ORDER.length; i++) {
  const prev = spot(`rfi-${OPEN_ORDER[i - 1]}`);
  const here = spot(`rfi-${OPEN_ORDER[i]}`);
  if (pct(here, "raise") <= pct(prev, "raise")) {
    fail(`rfi ${OPEN_ORDER[i]} (${pct(here, "raise").toFixed(1)}%) is not wider than ${OPEN_ORDER[i - 1]}`);
  }
  const dropped = [...prev.sets.raise].filter((h) => !here.sets.raise.has(h));
  if (dropped.length) fail(`rfi ${OPEN_ORDER[i]} drops ${dropped.join(", ")} that ${OPEN_ORDER[i - 1]} opens`);
}

console.log("6. defence widens as the raise comes from a later seat");
const BUCKET_ORDER = ["EP", "MP", "CO", "BTN", "SB"];
const bySeat = new Map();
for (const s of SPOTS.filter((x) => x.scenario === "vsopen")) {
  if (!bySeat.has(s.hero)) bySeat.set(s.hero, []);
  bySeat.get(s.hero).push(s);
}
for (const [seat, spots] of bySeat) {
  const ordered = spots.sort((a, b) => BUCKET_ORDER.indexOf(a.vs) - BUCKET_ORDER.indexOf(b.vs));
  for (let i = 1; i < ordered.length; i++) {
    if (played(ordered[i]) <= played(ordered[i - 1])) {
      fail(
        `${seat} defends ${played(ordered[i]).toFixed(1)}% vs ${ordered[i].vs} but ` +
          `${played(ordered[i - 1]).toFixed(1)}% vs ${ordered[i - 1].vs}`,
      );
    }
  }
}

console.log("7. the big blind defends wider than the small blind against the same raise");
for (const bucket of ["EP", "MP", "CO", "BTN"]) {
  const bb = spot(`vsopen-BB-${bucket}`);
  const sb = spot(`vsopen-SB-${bucket}`);
  if (!bb || !sb) continue;
  if (played(bb) <= played(sb)) {
    fail(`vs ${bucket}: BB defends ${played(bb).toFixed(1)}%, SB ${played(sb).toFixed(1)}%`);
  }
}

console.log("8. the big blind never folds to a limp, however many there are");
for (const count of ["one", "many"]) {
  const bbLimp = spot(`vslimp-BB-${count}`);
  if (!bbLimp) { fail(`vslimp-BB-${count} is missing`); continue; }
  if (!bbLimp.checksRest) fail(`BB vs ${count} limper(s) should check the rest of its hands`);
  if (bbLimp.actions.includes("fold")) fail(`BB vs ${count} limper(s) offers a fold`);
}

console.log("9. isolation ranges widen from early position to the button");
const LIMP_ORDER = ["EP", "MP", "BTN"];
for (let i = 1; i < LIMP_ORDER.length; i++) {
  const prev = spot(`vslimp-${LIMP_ORDER[i - 1]}-one`);
  const here = spot(`vslimp-${LIMP_ORDER[i]}-one`);
  if (pct(here, "raise") <= pct(prev, "raise")) {
    fail(`vslimp ${LIMP_ORDER[i]} isolates ${pct(here, "raise").toFixed(1)}%, not wider than ${LIMP_ORDER[i - 1]}`);
  }
}

console.log("10. only the small blind can complete when the action folds to it");
for (const s of SPOTS.filter((x) => x.scenario === "rfi")) {
  const hasCall = s.actions.includes("call");
  if (s.hero === "SB" && !hasCall) fail("the small blind cannot complete");
  if (s.hero !== "SB" && hasCall) fail(`${s.hero} is offered an open-limp`);
}

console.log("11. the small blind completes hands it is not already opening");
const sbOpen = spot("rfi-SB");
if (sbOpen.sets.call) {
  const total = pct(sbOpen, "raise") + pct(sbOpen, "call");
  if (total > 70) fail(`the small blind plays ${total.toFixed(1)}% of hands, which is too many`);
  if (pct(sbOpen, "call") >= pct(sbOpen, "raise")) {
    fail(`the small blind completes ${pct(sbOpen, "call").toFixed(1)}% but only raises ${pct(sbOpen, "raise").toFixed(1)}%`);
  }
}

console.log("12. trash never opens from a seat that is not the button or a blind");
for (const s of SPOTS.filter((x) => x.scenario === "rfi")) {
  if (s.hero === "BTN" || s.hero === "SB") continue;
  for (const hand of ["72o", "83o", "94o", "32o", "T2o"]) {
    if (s.sets.raise.has(hand)) fail(`rfi ${s.hero} opens ${hand}`);
  }
}

console.log("13. facing a 3-bet, you continue widest against the big blind");
const THREEBET_ORDER = ["IP", "SB", "BB"];
const byOpener = new Map();
for (const s of SPOTS.filter((x) => x.scenario === "vs3bet")) {
  if (!byOpener.has(s.hero)) byOpener.set(s.hero, []);
  byOpener.get(s.hero).push(s);
}
for (const [bucket, list] of byOpener) {
  const ordered = list.sort((a, b) => THREEBET_ORDER.indexOf(a.vs) - THREEBET_ORDER.indexOf(b.vs));
  for (let i = 1; i < ordered.length; i++) {
    if (played(ordered[i]) < played(ordered[i - 1])) {
      fail(
        `${bucket} continues ${played(ordered[i]).toFixed(1)}% vs a ${ordered[i].vs} 3-bet but ` +
          `${played(ordered[i - 1]).toFixed(1)}% vs ${ordered[i - 1].vs}`,
      );
    }
  }
}

console.log("14. a 4-bet is far tighter than the open that invited it");
for (const s of SPOTS.filter((x) => x.scenario === "vs3bet")) {
  const opens = SPOTS.filter((o) => o.scenario === "rfi" && s.heroSeats.includes(o.hero));
  const widestOpen = Math.max(...opens.map((o) => pct(o, "raise")));
  if (pct(s, "fourbet") >= widestOpen / 2) {
    fail(`${s.id} 4-bets ${pct(s, "fourbet").toFixed(1)}% against an open of ${widestOpen.toFixed(1)}%`);
  }
}

console.log("15. facing a 4-bet, almost everything folds");
for (const s of SPOTS.filter((x) => x.scenario === "vs4bet")) {
  if (played(s) > 6) fail(`${s.id} continues ${played(s).toFixed(1)}%, which is far too wide`);
  if (!s.sets.fivebet.has("AA")) fail(`${s.id} does not get aces in`);
}

console.log("16. squeezing is tighter than 3-betting the same opener heads-up");
const SQUEEZE_TO_BUCKET = { EP: "EP", MP: "MP", LATE: "CO" };
for (const s of SPOTS.filter((x) => x.scenario === "squeeze")) {
  const bucket = SQUEEZE_TO_BUCKET[s.vs];
  const heads = SPOTS.filter(
    (o) => o.scenario === "vsopen" && o.vs === bucket && s.heroSeats.includes(o.hero),
  );
  if (!heads.length) continue;
  const widest = Math.max(...heads.map((o) => pct(o, "threebet")));
  if (pct(s, "squeeze") > widest) {
    fail(
      `${s.id} squeezes ${pct(s, "squeeze").toFixed(1)}% but only 3-bets ` +
        `${widest.toFixed(1)}% against the same opener heads-up`,
    );
  }
}

console.log("17. more limpers means a tighter isolate and a wider overlimp");
for (const bucket of ["EP", "MP", "BTN", "SB", "BB"]) {
  const one = spot(`vslimp-${bucket}-one`);
  const many = spot(`vslimp-${bucket}-many`);
  if (!one || !many) continue;
  if (pct(many, "raise") >= pct(one, "raise")) {
    fail(`${bucket} isolates ${pct(many, "raise").toFixed(1)}% into a field but ${pct(one, "raise").toFixed(1)}% against one limper`);
  }
  if (!one.checksRest && pct(many, "call") <= pct(one, "call")) {
    fail(`${bucket} overlimps ${pct(many, "call").toFixed(1)}% into a field but ${pct(one, "call").toFixed(1)}% behind one limper`);
  }
}

// ---------------------------------------------------------------------------

const NAMES = { raise: "raise", threebet: "3-bet", call: "call", check: "check" };

console.log("\n--- opening ranges (folded to you) ---");
console.log("seat       open%   complete%   played%");
for (const s of SPOTS.filter((x) => x.scenario === "rfi")) {
  const complete = s.sets.call ? pct(s, "call").toFixed(1) : "-";
  console.log(
    s.hero.padEnd(10),
    pct(s, "raise").toFixed(1).padStart(6),
    String(complete).padStart(11),
    played(s).toFixed(1).padStart(9),
  );
}

console.log("\n--- facing a raise ---");
console.log("seat     vs      3bet%   call%   total%");
for (const s of SPOTS.filter((x) => x.scenario === "vsopen")) {
  console.log(
    s.hero.padEnd(8),
    s.vs.padEnd(6),
    pct(s, "threebet").toFixed(1).padStart(6),
    pct(s, "call").toFixed(1).padStart(7),
    played(s).toFixed(1).padStart(8),
  );
}

console.log("\n--- facing limpers ---");
console.log("seats                limpers    iso%   overlimp%");
for (const s of SPOTS.filter((x) => x.scenario === "vslimp")) {
  const rest = s.checksRest ? "  (checks the rest)" : "";
  console.log(
    (s.heroSeats.join("/")).padEnd(20),
    (s.limpers === "one" ? "1" : "2+").padStart(5),
    pct(s, "raise").toFixed(1).padStart(8),
    pct(s, "call").toFixed(1).padStart(10) + rest,
  );
}

console.log("\n--- you opened and got 3-bet ---");
console.log("opened   3-bet from   4bet%   call%   total%");
for (const s of SPOTS.filter((x) => x.scenario === "vs3bet")) {
  console.log(
    s.hero.padEnd(8),
    s.vs.padEnd(11),
    pct(s, "fourbet").toFixed(1).padStart(6),
    pct(s, "call").toFixed(1).padStart(7),
    played(s).toFixed(1).padStart(8),
  );
}

console.log("\n--- you 3-bet and got 4-bet ---");
console.log("spot                5bet%   call%   total%");
for (const s of SPOTS.filter((x) => x.scenario === "vs4bet")) {
  console.log(
    s.hero.padEnd(16),
    pct(s, "fivebet").toFixed(1).padStart(6),
    pct(s, "call").toFixed(1).padStart(7),
    played(s).toFixed(1).padStart(8),
  );
}

console.log("\n--- open plus a caller (squeeze) ---");
console.log("you      opener   squeeze%   call%   total%");
for (const s of SPOTS.filter((x) => x.scenario === "squeeze")) {
  console.log(
    s.hero.padEnd(8),
    s.vs.padEnd(8),
    pct(s, "squeeze").toFixed(1).padStart(8),
    pct(s, "call").toFixed(1).padStart(7),
    played(s).toFixed(1).padStart(8),
  );
}

console.log(`\n${SPOTS.length} spots.`);
console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
