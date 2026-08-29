/**
 * Preflop range data — the single source of truth.
 *
 * `build.js` expands this and injects it into the page, so the trainer can
 * never drill something different from what `check-ranges.js` validates.
 *
 * Notation:
 *   "66+"       every pocket pair from sixes up
 *   "88-JJ"     pocket pairs between eights and jacks
 *   "ATs+"      ATs, AJs, AQs, AKs   (fix the ace, walk the kicker up)
 *   "A2s-A5s"   A2s through A5s
 *   "AJo+"      AJo, AQo, AKo
 *   "T9s"       exactly that hand
 *
 * These are a consensus teaching baseline for 9-max cash at 100bb, not solver
 * output. The app says so too.
 */

const RANKS = "23456789TJQKA";
const ri = (c) => RANKS.indexOf(c);

function expandToken(token) {
  // Bounded range, e.g. "88-JJ" or "A2s-A5s".
  if (token.includes("-")) {
    const [a, b] = token.split("-");
    if (a.length === 2 && a[0] === a[1]) {
      let lo = ri(a[0]);
      let hi = ri(b[0]);
      if (lo > hi) [lo, hi] = [hi, lo];
      const out = [];
      for (let r = lo; r <= hi; r++) out.push(RANKS[r] + RANKS[r]);
      return out;
    }
    if (a[0] !== b[0] || a[2] !== b[2]) {
      throw new Error(`Bounded range must share a high card and suitedness: ${token}`);
    }
    let lo = ri(a[1]);
    let hi = ri(b[1]);
    if (lo > hi) [lo, hi] = [hi, lo];
    const out = [];
    for (let r = lo; r <= hi; r++) out.push(a[0] + RANKS[r] + a[2]);
    return out;
  }

  const plus = token.endsWith("+");
  const body = plus ? token.slice(0, -1) : token;

  if (body.length === 2 && body[0] === body[1]) {
    if (!plus) return [body];
    const out = [];
    for (let r = ri(body[0]); r < 13; r++) out.push(RANKS[r] + RANKS[r]);
    return out;
  }

  const hi = ri(body[0]);
  const lo = ri(body[1]);
  const sfx = body[2];
  if (hi < 0 || lo < 0 || (sfx !== "s" && sfx !== "o")) throw new Error(`Bad token: ${token}`);
  if (hi <= lo) throw new Error(`High card must outrank low: ${token}`);
  if (!plus) return [body];
  const out = [];
  for (let r = lo; r < hi; r++) out.push(RANKS[hi] + RANKS[r] + sfx);
  return out;
}

function expand(tokens) {
  const set = new Set();
  for (const t of tokens) for (const h of expandToken(t)) set.add(h);
  return set;
}

const combosOf = (h) => (h.length === 2 ? 6 : h[2] === "s" ? 4 : 12);

function percentOf(hands) {
  let combos = 0;
  for (const h of hands) combos += combosOf(h);
  return (100 * combos) / 1326;
}

/** Every seat, in order of preflop action. */
const SEATS = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

const SEAT_NAMES = {
  UTG: "under the gun",
  "UTG+1": "under the gun + 1",
  "UTG+2": "under the gun + 2",
  LJ: "the lojack",
  HJ: "the hijack",
  CO: "the cutoff",
  BTN: "the button",
  SB: "the small blind",
  BB: "the big blind",
};

/**
 * Opponent position buckets. Charts are taught this way, and it keeps the
 * number of distinct ranges to something that can actually be checked.
 */
const BUCKETS = {
  EP: { label: "early position", seats: ["UTG", "UTG+1", "UTG+2"] },
  MP: { label: "middle position", seats: ["LJ", "HJ"] },
  CO: { label: "the cutoff", seats: ["CO"] },
  BTN: { label: "the button", seats: ["BTN"] },
  SB: { label: "the small blind", seats: ["SB"] },
};

// ---------------------------------------------------------------------------
// 1. Folded to you — open or fold.
// ---------------------------------------------------------------------------

const RFI = {
  UTG: ["66+", "ATs+", "KTs+", "QJs", "JTs", "AJo+"],
  "UTG+1": ["55+", "A9s+", "KTs+", "QTs+", "JTs", "T9s", "AJo+", "KQo"],
  "UTG+2": ["44+", "A8s+", "K9s+", "Q9s+", "J9s+", "T9s", "98s", "ATo+", "KQo"],
  LJ: ["33+", "A7s+", "A5s", "K9s+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "ATo+", "KJo+"],
  HJ: ["22+", "A2s+", "K8s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s", "ATo+", "KJo+", "QJo"],
  CO: ["22+", "A2s+", "K5s+", "Q8s+", "J8s+", "T7s+", "96s+", "86s+", "75s+", "65s",
       "A9o+", "KTo+", "QTo+", "JTo"],
  BTN: ["22+", "A2s+", "K2s+", "Q4s+", "J6s+", "T6s+", "95s+", "85s+", "74s+", "64s+",
        "53s+", "43s", "A2o+", "K8o+", "Q9o+", "J9o+", "T9o", "98o"],
  SB: ["22+", "A2s+", "K2s+", "Q5s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "65s", "54s",
       "A2o+", "K9o+", "Q9o+", "J9o+", "T9o"],
};

// ---------------------------------------------------------------------------
// 2. Opened to you — 3-bet, call, or fold.
//    Keyed by your seat, then by the bucket the raise came from. Defence widens
//    as the opener's position gets later; the big blind is widest of all,
//    because it closes the action at a discount.
// ---------------------------------------------------------------------------

const VS_OPEN = {
  "UTG+1": {
    EP: { threebet: ["QQ+", "AKs", "AKo"], call: ["99-JJ", "AQs", "AJs", "KQs"] },
  },
  "UTG+2": {
    EP: { threebet: ["QQ+", "AKs", "AKo"], call: ["99-JJ", "AQs", "AJs", "KQs"] },
  },
  LJ: {
    EP: { threebet: ["QQ+", "AKs", "AKo"], call: ["88-JJ", "AQs", "AJs", "KQs", "QJs"] },
  },
  HJ: {
    EP: { threebet: ["QQ+", "AKs", "AKo"],
          call: ["88-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs"] },
    MP: { threebet: ["JJ+", "AKs", "AKo", "AQs"],
          call: ["88-TT", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs"] },
  },
  CO: {
    EP: { threebet: ["QQ+", "AKs", "AKo"],
          call: ["77-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs"] },
    MP: { threebet: ["JJ+", "AKs", "AKo", "AQs"],
          call: ["77-TT", "AJs", "ATs", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s"] },
  },
  BTN: {
    EP: { threebet: ["QQ+", "AKs", "AKo", "AQs"],
          call: ["66-JJ", "AJs", "ATs", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s"] },
    MP: { threebet: ["JJ+", "AKs", "AKo", "AQs", "A5s"],
          call: ["55-TT", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "J9s",
                 "T9s", "98s", "AQo", "KQo"] },
    CO: { threebet: ["TT+", "AKs", "AQs", "AJs", "A4s", "A5s", "KQs", "AKo"],
          call: ["44-99", "ATs", "A9s", "A8s", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s", "JTs",
                 "J9s", "T9s", "98s", "87s", "AQo", "AJo", "KQo"] },
  },
  SB: {
    EP: { threebet: ["QQ+", "AKs", "AKo", "AQs"], call: ["TT-JJ", "AJs", "KQs"] },
    MP: { threebet: ["JJ+", "AKs", "AKo", "AQs"], call: ["99-TT", "AJs", "ATs", "KQs", "QJs"] },
    CO: { threebet: ["TT+", "AKs", "AQs", "AJs", "A5s", "AKo"],
          call: ["77-99", "ATs", "KQs", "KJs", "QJs", "JTs"] },
    BTN: { threebet: ["88+", "ATs+", "A3s-A5s", "KJs+", "QJs", "AQo+"],
           call: ["44-77", "A9s", "KTs", "QTs", "JTs", "T9s", "98s", "AJo", "KQo"] },
  },
  BB: {
    EP: { threebet: ["QQ+", "AKs", "AKo", "A5s"],
          call: ["22-JJ", "AQs", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs",
                 "T9s", "98s", "AQo", "AJo", "KQo"] },
    MP: { threebet: ["JJ+", "AKs", "AKo", "AQs", "A3s-A5s"],
          call: ["22-TT", "AJs", "ATs", "A6s-A9s", "A2s", "K9s-KQs", "Q9s-QJs", "J9s-JTs",
                 "T9s", "98s", "87s", "AQo", "AJo", "ATo", "KQo", "KJo"] },
    CO: { threebet: ["TT+", "AKs", "AQs", "AJs", "A2s-A5s", "KQs", "AKo", "AQo"],
          call: ["22-99", "A6s-ATs", "K7s-KJs", "Q8s-QJs", "J8s-JTs", "T8s-T9s", "98s", "87s",
                 "76s", "65s", "AJo", "ATo", "A9o", "KQo", "KJo", "KTo", "QJo", "QTo", "JTo"] },
    BTN: { threebet: ["99+", "ATs+", "A2s-A5s", "KJs+", "QJs", "JTs", "AJo+", "KQo"],
           call: ["22-88", "A6s-A9s", "K5s-KTs", "Q7s-QTs", "J7s-J9s", "T7s-T9s", "96s-98s",
                  "86s-87s", "75s-76s", "65s", "54s", "A2o-ATo", "K9o-KJo", "Q9o-QJo",
                  "J9o-JTo", "T9o", "98o"] },
    SB: { threebet: ["77+", "A9s+", "A2s-A5s", "KTs+", "QTs+", "JTs", "T9s", "ATo+", "KJo+"],
          call: ["22-66", "A6s-A8s", "K2s-K9s", "Q5s-Q9s", "J6s-J9s", "T6s-T8s", "95s-98s",
                 "85s-87s", "74s-76s", "64s-65s", "53s-54s", "43s", "A2o-A9o", "K7o-KTo",
                 "Q8o-QJo", "J8o-JTo", "T8o-T9o", "97o-98o", "87o"] },
  },
};

// ---------------------------------------------------------------------------
// 3. Limped to you — isolate, overlimp, or fold.
//    The big blind is a special case: checking is free, so it never folds.
// ---------------------------------------------------------------------------

const VS_LIMP = {
  EP: {
    seats: ["UTG+1", "UTG+2", "LJ"],
    raise: ["TT+", "AJs+", "KQs", "AQo+"],
    call: ["22-99", "A8s-ATs", "KJs", "QJs", "JTs", "T9s"],
  },
  MP: {
    seats: ["HJ", "CO"],
    raise: ["77+", "A9s+", "KTs+", "QJs", "JTs", "ATo+", "KQo"],
    call: ["22-66", "A2s-A8s", "K9s", "QTs", "J9s", "T9s", "98s"],
  },
  BTN: {
    seats: ["BTN"],
    raise: ["55+", "A2s+", "K8s+", "Q9s+", "J9s+", "T9s", "A9o+", "KJo+", "QJo"],
    call: ["22-44", "K2s-K7s", "Q5s-Q8s", "J7s-J8s", "T8s", "98s", "87s", "76s"],
  },
  SB: {
    seats: ["SB"],
    raise: ["66+", "A7s+", "KTs+", "QJs", "ATo+", "KQo"],
    call: ["22-55", "A2s-A6s", "K7s-K9s", "QTs", "JTs", "T9s", "98s"],
  },
  BB: {
    seats: ["BB"],
    raise: ["66+", "A8s+", "KTs+", "QJs", "JTs", "ATo+", "KQo"],
    // Everything else checks. The big blind never folds to a limp.
    call: [],
    checksRest: true,
  },
};

// ---------------------------------------------------------------------------
// Building the spot list
// ---------------------------------------------------------------------------

const behindCount = (seat) => SEATS.length - 1 - SEATS.indexOf(seat);

function buildSpots() {
  const spots = [];

  for (const seat of Object.keys(RFI)) {
    spots.push({
      id: `rfi-${seat}`,
      scenario: "rfi",
      hero: seat,
      heroSeats: [seat],
      heroName: SEAT_NAMES[seat],
      behind: behindCount(seat),
      notation: { raise: RFI[seat] },
      sets: { raise: expand(RFI[seat]) },
      actions: ["raise", "fold"],
    });
  }

  for (const seat of Object.keys(VS_OPEN)) {
    for (const bucket of Object.keys(VS_OPEN[seat])) {
      const entry = VS_OPEN[seat][bucket];
      spots.push({
        id: `vsopen-${seat}-${bucket}`,
        scenario: "vsopen",
        hero: seat,
        heroSeats: [seat],
        heroName: SEAT_NAMES[seat],
        behind: behindCount(seat),
        vs: bucket,
        vsName: BUCKETS[bucket].label,
        notation: { threebet: entry.threebet, call: entry.call },
        sets: { threebet: expand(entry.threebet), call: expand(entry.call) },
        actions: ["threebet", "call", "fold"],
      });
    }
  }

  for (const bucket of Object.keys(VS_LIMP)) {
    const entry = VS_LIMP[bucket];
    const last = entry.seats[entry.seats.length - 1];
    spots.push({
      id: `vslimp-${bucket}`,
      scenario: "vslimp",
      hero: bucket,
      heroSeats: entry.seats,
      heroName: entry.seats.length > 1 ? entry.seats.join(" / ") : SEAT_NAMES[last],
      behind: behindCount(last),
      notation: { raise: entry.raise, call: entry.call },
      sets: { raise: expand(entry.raise), call: expand(entry.call) },
      actions: entry.checksRest ? ["raise", "check"] : ["raise", "call", "fold"],
      checksRest: Boolean(entry.checksRest),
    });
  }

  return spots;
}

const SPOTS = buildSpots();

module.exports = {
  RANKS, SEATS, SEAT_NAMES, BUCKETS, RFI, VS_OPEN, VS_LIMP, SPOTS,
  expand, expandToken, combosOf, percentOf,
};
