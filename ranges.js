/**
 * 9-max full ring RFI (raise first in) opening ranges, 100bb cash.
 *
 * Written in standard range notation so it stays readable and auditable:
 *   "66+"   every pocket pair from sixes up
 *   "ATs+"  ATs, AJs, AQs, AKs  (fix the ace, walk the kicker up)
 *   "AJo+"  AJo, AQo, AKo
 *   "T9s"   exactly that hand
 *
 * These are a consensus teaching baseline, not solver output. They are close to
 * what most full-ring charts agree on; they are not provably optimal, and the
 * app says so.
 */

const RANKS = "23456789TJQKA";
const rankIndex = (c) => RANKS.indexOf(c);

/** Expands one token of range notation into explicit hand names. */
function expandToken(token) {
  const plus = token.endsWith("+");
  const body = plus ? token.slice(0, -1) : token;

  // Pocket pair, e.g. "66" or "66+"
  if (body.length === 2 && body[0] === body[1]) {
    const from = rankIndex(body[0]);
    if (!plus) return [body];
    const out = [];
    for (let r = from; r < 13; r++) out.push(RANKS[r] + RANKS[r]);
    return out;
  }

  // Suited or offsuit, e.g. "ATs", "KJo+"
  const high = rankIndex(body[0]);
  const low = rankIndex(body[1]);
  const suffix = body[2];
  if (high < 0 || low < 0 || (suffix !== "s" && suffix !== "o")) {
    throw new Error(`Bad range token: ${token}`);
  }
  if (high <= low) throw new Error(`High card must outrank low: ${token}`);
  if (!plus) return [body];

  const out = [];
  for (let r = low; r < high; r++) out.push(RANKS[high] + RANKS[r] + suffix);
  return out;
}

function expand(notation) {
  const hands = new Set();
  for (const token of notation) {
    for (const hand of expandToken(token)) hands.add(hand);
  }
  return hands;
}

const combosOf = (hand) => (hand.length === 2 ? 6 : hand[2] === "s" ? 4 : 12);

function percentOf(hands) {
  let combos = 0;
  for (const hand of hands) combos += combosOf(hand);
  return (100 * combos) / 1326;
}

/** Seats that can open first-in, in order of action. */
const POSITIONS = [
  {
    id: "UTG",
    label: "UTG",
    full: "Under the gun",
    notation: ["66+", "ATs+", "KTs+", "QJs", "JTs", "AJo+"],
  },
  {
    id: "UTG1",
    label: "UTG+1",
    full: "Under the gun + 1",
    notation: ["55+", "A9s+", "KTs+", "QTs+", "JTs", "T9s", "AJo+", "KQo"],
  },
  {
    id: "UTG2",
    label: "UTG+2",
    full: "Under the gun + 2",
    notation: ["44+", "A8s+", "K9s+", "Q9s+", "J9s+", "T9s", "98s", "ATo+", "KQo"],
  },
  {
    id: "LJ",
    label: "LJ",
    full: "Lojack",
    notation: [
      "33+", "A7s+", "A5s", "K9s+", "Q9s+", "J9s+", "T8s+", "98s", "87s",
      "ATo+", "KJo+",
    ],
  },
  {
    id: "HJ",
    label: "HJ",
    full: "Hijack",
    notation: [
      "22+", "A2s+", "K8s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s",
      "ATo+", "KJo+", "QJo",
    ],
  },
  {
    id: "CO",
    label: "CO",
    full: "Cutoff",
    notation: [
      "22+", "A2s+", "K5s+", "Q8s+", "J8s+", "T7s+", "96s+", "86s+", "75s+",
      "65s", "A9o+", "KTo+", "QTo+", "JTo",
    ],
  },
  {
    id: "BTN",
    label: "BTN",
    full: "Button",
    notation: [
      "22+", "A2s+", "K2s+", "Q4s+", "J6s+", "T6s+", "95s+", "85s+", "74s+",
      "64s+", "53s+", "43s", "A2o+", "K8o+", "Q9o+", "J9o+", "T9o", "98o",
    ],
  },
  {
    id: "SB",
    label: "SB",
    full: "Small blind",
    notation: [
      "22+", "A2s+", "K2s+", "Q5s+", "J7s+", "T7s+", "96s+", "86s+", "75s+",
      "65s", "54s", "A2o+", "K9o+", "Q9o+", "J9o+", "T9o",
    ],
  },
];

const RANGES = POSITIONS.map((p) => {
  const hands = expand(p.notation);
  return { ...p, hands, percent: percentOf(hands) };
});

module.exports = { RANKS, RANGES, POSITIONS, expand, expandToken, combosOf, percentOf };
