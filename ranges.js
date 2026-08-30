/**
 * Preflop range data - the single source of truth.
 *
 * Every table below is EMPTY on purpose. The machinery around them is intact:
 * the notation expander, the seat and bucket definitions, and buildSpots(),
 * which turns filled-in tables into the spot list the page drills. Fill a table
 * and the spots appear; leave it empty and that scenario simply does not exist.
 *
 * `build.js` injects whatever is here into the page, so the trainer can never
 * drill something different from what `check-ranges.js` validates.
 *
 * Notation:
 *   "66+"       every pocket pair from sixes up
 *   "88-JJ"     pocket pairs between eights and jacks
 *   "ATs+"      ATs, AJs, AQs, AKs   (fix the ace, walk the kicker up)
 *   "A2s-A5s"   A2s through A5s
 *   "AJo+"      AJo, AQo, AKo
 *   "T9s"       exactly that hand
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
// The range tables. All empty - fill in what you want to drill.
//
// Actions are named by what they are, not by button order. An action key maps
// to a list of notation tokens; every hand not named anywhere in a spot folds
// (or checks, in the one spot where folding is not an option).
// ---------------------------------------------------------------------------

/**
 * 1. Folded to you - open, fold, or come in for the minimum.
 *
 *   SEAT: {
 *     raise:   [tokens],
 *     call:    [tokens],              // optional: limp, or complete in the SB
 *     labels:  { call: "Limp" },      // optional: what to call the action
 *   }
 *
 * Keyed by exact seat, since every seat opens differently.
 */
const RFI = {};

/**
 * 2. Someone raised and it is on you - 3-bet, call, or fold.
 *
 *   HERO_SEAT: {
 *     OPENER_BUCKET: { threebet: [tokens], call: [tokens] },
 *   }
 *
 * Opener bucket is a key of BUCKETS. Only buckets that act before the hero
 * seat make sense.
 */
const VS_OPEN = {};

/**
 * 3. The pot is limped to you - isolate, overlimp, or fold.
 *
 *   BUCKET: {
 *     seats: [seats this bucket covers],
 *     one:   { raise: [tokens], call: [tokens] },
 *     many:  { raise: [tokens], call: [tokens] },
 *   }
 *
 * Set `checksRest: true` on an entry instead of `call` where folding is not an
 * option - the big blind closing the action for free.
 */
const VS_LIMP = {};

/** Where a 3-bet came from, relative to you. Structural, not range data. */
const THREEBETTER = {
  IP: { label: "a player in position" },
  SB: { label: "the small blind" },
  BB: { label: "the big blind" },
};

/**
 * 4. You opened and got 3-bet - 4-bet, call, or fold.
 *
 *   OPENER_BUCKET: {
 *     seats: [seats this bucket covers],
 *     IP:  { fourbet: [tokens], call: [tokens] },
 *     SB:  { fourbet: [tokens], call: [tokens] },
 *     BB:  { fourbet: [tokens], call: [tokens] },
 *   }
 *
 * Inner keys are keys of THREEBETTER; any may be omitted.
 */
const VS_3BET = {};

/**
 * 5. A 4-bet is on you - 5-bet, call, or fold.
 *
 *   KEY: {
 *     heroLabel: "in position",
 *     heroSeats: [seats],
 *     vsLabel:   "a 4-bet from the original raiser",
 *     cold:      true,              // optional - see below
 *     fivebet:   [tokens],
 *     call:      [tokens],
 *   }
 *
 * Two different spots live here. Without `cold`, you 3-bet and the original
 * raiser came back over the top. With `cold`, you never 3-bet at all: you
 * opened, someone behind you 3-bet, and a third player cold 4-bet - so the
 * 3-bettor still has a decision left behind you. An opener in any seat can
 * reach the cold version, under the gun included.
 */
const VS_4BET = {};

/**
 * 5b. It got 3-bet before it reached you - cold 4-bet, cold call, or fold.
 *
 *   KEY: {
 *     heroLabel: "in position",
 *     heroSeats: [seats],
 *     opener:    "EP",              // a key of BUCKETS - where the open came from
 *     vsLabel:   "a 3-bet of an early position open",
 *     fourbet:   [tokens],
 *     call:      [tokens],
 *   }
 *
 * Distinct from spot 4: there you had already opened and had range invested.
 * Here you have nothing in the pot and two opponents, one of whom has shown
 * real strength and one who has not yet acted again.
 */
const COLD_3BET = {};

/** Where a squeeze opportunity's original raise came from. Structural. */
const SQUEEZE_OPENER = {
  EP: { label: "early position" },
  MP: { label: "middle position" },
  LATE: { label: "the cutoff or button" },
};

/**
 * 6. Someone opened and someone else called - squeeze, call, or fold.
 *
 *   HERO_KEY: {
 *     heroLabel: "in position behind the caller",
 *     heroSeats: [seats],
 *     EP:   { squeeze: [tokens], call: [tokens] },
 *     MP:   { squeeze: [tokens], call: [tokens] },
 *     LATE: { squeeze: [tokens], call: [tokens] },
 *   }
 *
 * Inner keys are keys of SQUEEZE_OPENER; any may be omitted.
 */
const SQUEEZE = {};

// ---------------------------------------------------------------------------
// Building the spot list
// ---------------------------------------------------------------------------

const behindCount = (seat) => SEATS.length - 1 - SEATS.indexOf(seat);

function buildSpots() {
  const spots = [];

  for (const seat of Object.keys(RFI)) {
    const entry = RFI[seat];
    const notation = { raise: entry.raise };
    const sets = { raise: expand(entry.raise) };
    const actions = ["raise"];
    if (entry.call) {
      notation.call = entry.call;
      sets.call = expand(entry.call);
      actions.push("call");
    }
    actions.push("fold");

    spots.push({
      id: `rfi-${seat}`,
      scenario: "rfi",
      hero: seat,
      heroSeats: [seat],
      heroName: SEAT_NAMES[seat],
      behind: behindCount(seat),
      notation, sets, actions,
      labels: entry.labels || null,
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
        vsSeats: BUCKETS[bucket].seats,
        notation: { threebet: entry.threebet, call: entry.call },
        sets: { threebet: expand(entry.threebet), call: expand(entry.call) },
        actions: ["threebet", "call", "fold"],
      });
    }
  }

  for (const bucket of Object.keys(VS_LIMP)) {
    const group = VS_LIMP[bucket];
    const last = group.seats[group.seats.length - 1];
    for (const count of ["one", "many"]) {
      const entry = group[count];
      const notation = { raise: entry.raise };
      const sets = { raise: expand(entry.raise) };
      const actions = ["raise"];
      if (!entry.checksRest) {
        notation.call = entry.call;
        sets.call = expand(entry.call);
        actions.push("call", "fold");
      } else {
        actions.push("check");
      }
      spots.push({
        id: `vslimp-${bucket}-${count}`,
        scenario: "vslimp",
        hero: bucket,
        heroSeats: group.seats,
        heroName: group.seats.length > 1 ? group.seats.join(" / ") : SEAT_NAMES[last],
        behind: behindCount(last),
        limpers: count,
        notation, sets, actions,
        checksRest: Boolean(entry.checksRest),
        labels: { raise: "Isolate", call: "Overlimp" },
      });
    }
  }

  for (const bucket of Object.keys(VS_3BET)) {
    const group = VS_3BET[bucket];
    for (const from of Object.keys(THREEBETTER)) {
      const entry = group[from];
      if (!entry) continue;
      const last = group.seats[group.seats.length - 1];
      spots.push({
        id: `vs3bet-${bucket}-${from}`,
        scenario: "vs3bet",
        hero: bucket,
        heroSeats: group.seats,
        heroName: group.seats.length > 1 ? group.seats.join(" / ") : SEAT_NAMES[last],
        behind: behindCount(last),
        vs: from,
        vsName: THREEBETTER[from].label,
        notation: { fourbet: entry.fourbet, call: entry.call },
        sets: { fourbet: expand(entry.fourbet), call: expand(entry.call) },
        actions: ["fourbet", "call", "fold"],
      });
    }
  }

  for (const key of Object.keys(VS_4BET)) {
    const entry = VS_4BET[key];
    spots.push({
      id: `vs4bet-${key}`,
      scenario: "vs4bet",
      hero: key,
      heroSeats: entry.heroSeats,
      heroName: entry.heroLabel,
      behind: behindCount(entry.heroSeats[entry.heroSeats.length - 1]),
      vs: key,
      vsName: entry.vsLabel,
      cold: Boolean(entry.cold),
      notation: { fivebet: entry.fivebet, call: entry.call },
      sets: { fivebet: expand(entry.fivebet), call: expand(entry.call) },
      actions: ["fivebet", "call", "fold"],
    });
  }

  for (const key of Object.keys(COLD_3BET)) {
    const entry = COLD_3BET[key];
    const last = entry.heroSeats[entry.heroSeats.length - 1];
    spots.push({
      id: `vs3betcold-${key}`,
      scenario: "vs3betcold",
      hero: key,
      heroSeats: entry.heroSeats,
      heroName: entry.heroLabel,
      behind: behindCount(last),
      vs: entry.opener,
      vsName: entry.vsLabel,
      notation: { fourbet: entry.fourbet, call: entry.call },
      sets: { fourbet: expand(entry.fourbet), call: expand(entry.call) },
      actions: ["fourbet", "call", "fold"],
    });
  }

  for (const bucket of Object.keys(SQUEEZE)) {
    const group = SQUEEZE[bucket];
    for (const opener of Object.keys(SQUEEZE_OPENER)) {
      const entry = group[opener];
      if (!entry) continue;
      spots.push({
        id: `squeeze-${bucket}-${opener}`,
        scenario: "squeeze",
        hero: bucket,
        heroSeats: group.heroSeats,
        heroName: group.heroLabel,
        behind: behindCount(group.heroSeats[group.heroSeats.length - 1]),
        vs: opener,
        vsName: SQUEEZE_OPENER[opener].label,
        notation: { squeeze: entry.squeeze, call: entry.call },
        sets: { squeeze: expand(entry.squeeze), call: expand(entry.call) },
        actions: ["squeeze", "call", "fold"],
      });
    }
  }

  return spots;
}

const SPOTS = buildSpots();

module.exports = {
  RANKS, SEATS, SEAT_NAMES, BUCKETS, THREEBETTER, SQUEEZE_OPENER,
  RFI, VS_OPEN, VS_LIMP, VS_3BET, VS_4BET, COLD_3BET, SQUEEZE, SPOTS,
  expand, expandToken, combosOf, percentOf,
};
