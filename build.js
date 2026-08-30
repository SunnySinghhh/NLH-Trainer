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
const { SEATS, SEAT_NAMES, BUCKETS, SPOTS, percentOf } = require("./ranges.js");

const payload = {
  seats: SEATS,
  seatNames: SEAT_NAMES,
  buckets: Object.fromEntries(
    Object.entries(BUCKETS).map(([id, b]) => [id, { label: b.label, seats: b.seats }]),
  ),
  spots: SPOTS.map((s) => {
    // Only non-fold hands are stored; anything absent is a fold (or a check,
    // in the one spot where folding is not an option).
    const assign = {};
    for (const action of Object.keys(s.sets)) {
      for (const hand of s.sets[action]) assign[hand] = action;
    }
    const pct = {};
    for (const action of Object.keys(s.sets)) pct[action] = Number(percentOf(s.sets[action]).toFixed(2));

    return {
      id: s.id,
      scenario: s.scenario,
      hero: s.hero,
      heroSeats: s.heroSeats,
      heroName: s.heroName,
      behind: s.behind,
      vs: s.vs || null,
      vsName: s.vsName || null,
      actions: s.actions,
      labels: s.labels || null,
      checksRest: Boolean(s.checksRest),
      cold: Boolean(s.cold),
      assign,
      pct,
      notation: s.notation,
    };
  }),
};

const src = `${__dirname}/trainer.src.html`;
const out = `${__dirname}/trainer.html`;
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
console.log(`wrote trainer.html — ${payload.spots.length} spots, ${built.length} bytes, pure ASCII`);
