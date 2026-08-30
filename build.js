/**
 * Builds trainer.html from trainer.src.html.
 *
 * Two jobs:
 *
 * 1. Inject the range data from ranges.js. The data lives in exactly one place,
 *    so the page can never drift from what check-ranges.js validates.
 *
 * 2. Escape every non-ASCII character. The page gets served from places that do
 *    not always declare a charset, and a missing one turns the card suits into
 *    mojibake. Escaping removes the dependency rather than trusting a <meta>.
 */

const fs = require("fs");
const { SEATS, SEAT_NAMES, TESTED_SEATS, FACING, OPTIONS, RNG_ORDER, SPOTS } = require("./ranges.js");

const payload = {
  seats: SEATS,
  seatNames: SEAT_NAMES,
  testedSeats: TESTED_SEATS,
  facing: FACING,
  options: OPTIONS,
  rngOrder: RNG_ORDER,
  spots: SPOTS.map((s) => ({
    id: s.id,
    seat: s.seat,
    seatName: s.seatName,
    facing: s.facing,
    facingLabel: s.facingLabel,
    facingFull: s.facingFull,
    // hand -> {action: percent}. Anything absent folds 100% of the time.
    weights: s.weights,
    // hand -> [{action, lo, hi}] covering 1-100, in fold/call/raise/check order.
    bands: s.bands,
    mixedCount: s.mixedCount,
    pct: s.pct,
    notation: s.notation,
  })),
};

const src = `${__dirname}/trainer.src.html`;
const out = `${__dirname}/index.html`;
const html = fs.readFileSync(src, "utf8");

if (!html.includes("__RANGE_DATA__")) throw new Error("template has no __RANGE_DATA__ placeholder");
const withData = html.replace("__RANGE_DATA__", JSON.stringify(payload));

const marker = "<script>\n(() => {";
const start = withData.indexOf(marker);
if (start < 0) throw new Error("could not find the script block");
const end = withData.indexOf("</script>", start);

const entities = (t) =>
  [...t].map((c) => (c.charCodeAt(0) < 128 ? c : `&#x${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")};`)).join("");
const escapes = (t) =>
  [...t].map((c) => (c.charCodeAt(0) < 128 ? c : `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)).join("");

const built =
  entities(withData.slice(0, start)) + escapes(withData.slice(start, end)) + entities(withData.slice(end));

const bad = [...new Set([...built].filter((c) => c.charCodeAt(0) > 127))];
if (bad.length) throw new Error(`still non-ASCII: ${bad.join(" ")}`);

fs.writeFileSync(out, built);
const mixed = SPOTS.reduce((t, s) => t + s.mixedCount, 0);
console.log(
  `wrote index.html - ${payload.spots.length} spots, ${mixed} mixed hands, ${built.length} bytes, pure ASCII`,
);
