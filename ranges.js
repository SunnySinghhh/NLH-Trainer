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
// 1. Folded to you — open, or fold.
//
//    Only the small blind gets a third option. It can complete for half a big
//    blind and close the action against one player, which is a price no other
//    seat is offered: everyone else calling here would be open-limping into a
//    field with players still to act, and that is not part of these charts.
// ---------------------------------------------------------------------------

const RFI = {
  UTG: { raise: ["66+", "ATs+", "KTs+", "QJs", "JTs", "AJo+"] },
  "UTG+1": { raise: ["55+", "A9s+", "KTs+", "QTs+", "JTs", "T9s", "AJo+", "KQo"] },
  "UTG+2": { raise: ["44+", "A8s+", "K9s+", "Q9s+", "J9s+", "T9s", "98s", "ATo+", "KQo"] },
  LJ: { raise: ["33+", "A7s+", "A5s", "K9s+", "Q9s+", "J9s+", "T8s+", "98s", "87s", "ATo+", "KJo+"] },
  HJ: { raise: ["22+", "A2s+", "K8s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s", "ATo+", "KJo+", "QJo"] },
  CO: { raise: ["22+", "A2s+", "K5s+", "Q8s+", "J8s+", "T7s+", "96s+", "86s+", "75s+", "65s",
                "A9o+", "KTo+", "QTo+", "JTo"] },
  BTN: { raise: ["22+", "A2s+", "K2s+", "Q4s+", "J6s+", "T6s+", "95s+", "85s+", "74s+", "64s+",
                 "53s+", "43s", "A2o+", "K8o+", "Q9o+", "J9o+", "T9o", "98o"] },
  SB: {
    raise: ["22+", "A2s+", "K2s+", "Q5s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "65s", "54s",
            "A2o+", "K9o+", "Q9o+", "J9o+", "T9o"],
    // Getting 2 to 1 with only the big blind left to act, these are playable
    // for half a blind but not strong enough to open.
    call: ["Q2s-Q4s", "J2s-J6s", "T5s-T6s", "94s-95s", "84s-85s", "73s-74s", "63s-64s",
           "52s-53s", "43s", "K5o-K8o", "Q7o-Q8o", "J7o-J8o", "T8o", "98o", "87o"],
    labels: { call: "Complete" },
  },
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
//    Split by how many players have limped. More limpers means better pot odds
//    to come along, but worse equity realisation for a raise, so isolation
//    ranges tighten and get more value-heavy while overlimping widens.
//    The big blind is a special case: checking is free, so it never folds.
// ---------------------------------------------------------------------------

const VS_LIMP = {
  EP: {
    seats: ["UTG+1", "UTG+2", "LJ"],
    one: {
      raise: ["TT+", "AJs+", "KQs", "AQo+"],
      call: ["22-99", "A8s-ATs", "KJs", "QJs", "JTs", "T9s"],
    },
    many: {
      raise: ["JJ+", "AQs+", "AKo"],
      call: ["22-TT", "A2s-ATs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s"],
    },
  },
  MP: {
    seats: ["HJ", "CO"],
    one: {
      raise: ["77+", "A9s+", "KTs+", "QJs", "JTs", "ATo+", "KQo"],
      call: ["22-66", "A2s-A8s", "K9s", "QTs", "J9s", "T9s", "98s"],
    },
    many: {
      raise: ["99+", "AJs+", "KQs", "AQo+"],
      call: ["22-88", "A2s-ATs", "K9s-KJs", "QTs-QJs", "J9s-JTs", "T8s-T9s", "98s", "87s"],
    },
  },
  BTN: {
    seats: ["BTN"],
    one: {
      raise: ["55+", "A2s+", "K8s+", "Q9s+", "J9s+", "T9s", "A9o+", "KJo+", "QJo"],
      call: ["22-44", "K2s-K7s", "Q5s-Q8s", "J7s-J8s", "T8s", "98s", "87s", "76s"],
    },
    many: {
      raise: ["77+", "A8s+", "KTs+", "QJs", "JTs", "ATo+", "KQo"],
      call: ["22-66", "A2s-A7s", "K2s-K9s", "Q5s-QTs", "J7s-J9s", "T7s-T8s", "96s-98s",
             "86s-87s", "75s-76s", "65s", "54s"],
    },
  },
  SB: {
    seats: ["SB"],
    one: {
      raise: ["66+", "A7s+", "KTs+", "QJs", "ATo+", "KQo"],
      call: ["22-55", "A2s-A6s", "K7s-K9s", "QTs", "JTs", "T9s", "98s"],
    },
    many: {
      raise: ["88+", "ATs+", "KQs", "AQo+"],
      call: ["22-77", "A2s-A9s", "K7s-KJs", "QTs-QJs", "JTs", "T9s", "98s", "87s"],
    },
  },
  BB: {
    seats: ["BB"],
    one: { raise: ["66+", "A8s+", "KTs+", "QJs", "JTs", "ATo+", "KQo"], call: [], checksRest: true },
    many: { raise: ["88+", "ATs+", "KQs", "AJo+"], call: [], checksRest: true },
  },
};

// ---------------------------------------------------------------------------
// 4. You opened and got 3-bet — 4-bet, call, or fold.
//    Keyed by the bucket you opened from, then by where the 3-bet came from.
//    You continue wider against the big blind because it 3-bets widest, and a
//    strong opening range (early position) continues at a higher rate than a
//    wide one (the button), even though it is a smaller range in absolute terms.
// ---------------------------------------------------------------------------

/** Where the 3-bet came from, relative to you. */
const THREEBETTER = {
  IP: { label: "a player in position" },
  SB: { label: "the small blind" },
  BB: { label: "the big blind" },
};

const VS_3BET = {
  EP: {
    seats: ["UTG", "UTG+1", "UTG+2"],
    IP: { fourbet: ["QQ+", "AKs", "AKo"], call: ["TT-JJ", "AQs", "AJs", "KQs"] },
    SB: { fourbet: ["QQ+", "AKs", "AKo"], call: ["99-JJ", "AQs", "AJs", "KQs"] },
    BB: { fourbet: ["QQ+", "AKs", "AKo", "A5s"],
          call: ["88-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs"] },
  },
  MP: {
    seats: ["LJ", "HJ"],
    IP: { fourbet: ["QQ+", "AKs", "AKo"], call: ["TT-JJ", "AQs", "AJs", "KQs"] },
    SB: { fourbet: ["QQ+", "AKs", "AKo", "A5s"],
          call: ["99-JJ", "AQs", "AJs", "KQs", "QJs"] },
    BB: { fourbet: ["QQ+", "AKs", "AKo", "A4s", "A5s"],
          call: ["88-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs"] },
  },
  CO: {
    seats: ["CO"],
    IP: { fourbet: ["QQ+", "AKs", "AKo", "A5s"],
          call: ["99-JJ", "AQs", "AJs", "KQs", "KJs", "QJs"] },
    SB: { fourbet: ["QQ+", "AKs", "AKo", "A4s", "A5s"],
          call: ["88-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs"] },
    BB: { fourbet: ["JJ+", "AKs", "AQs", "AKo", "A4s", "A5s"],
          call: ["77-TT", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs",
                 "T9s", "AQo"] },
  },
  BTN: {
    seats: ["BTN"],
    SB: { fourbet: ["QQ+", "AKs", "AQs", "AKo", "A4s", "A5s"],
          call: ["88-JJ", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "AQo"] },
    BB: { fourbet: ["JJ+", "AKs", "AQs", "AKo", "A3s-A5s"],
          call: ["66-TT", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs",
                 "T9s", "98s", "AQo", "AJo"] },
  },
  SB: {
    seats: ["SB"],
    BB: { fourbet: ["QQ+", "AKs", "AQs", "AKo", "A4s", "A5s"],
          call: ["88-JJ", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "AQo"] },
  },
};

// ---------------------------------------------------------------------------
// 5. You 3-bet and got 4-bet — shove, call, or fold.
//    The tightest spot in the game and the one the sources agree on most: put
//    the very top in, continue with a handful more, let the rest go.
// ---------------------------------------------------------------------------

const VS_4BET = {
  "IP-EARLY": {
    heroLabel: "in position",
    heroSeats: ["LJ", "HJ", "CO", "BTN"],
    vsLabel: "an early or middle position opener",
    fivebet: ["AA", "KK"],
    call: ["QQ", "AKs", "AKo"],
  },
  "IP-LATE": {
    heroLabel: "in position",
    heroSeats: ["BTN"],
    vsLabel: "a cutoff or button opener",
    fivebet: ["AA", "KK", "AKs"],
    call: ["JJ", "QQ", "AKo", "AQs"],
  },
  "BLIND-EARLY": {
    heroLabel: "from the blinds",
    heroSeats: ["SB", "BB"],
    vsLabel: "an early or middle position opener",
    fivebet: ["AA", "KK"],
    call: ["QQ", "AKs", "AKo"],
  },
  "BLIND-LATE": {
    heroLabel: "from the blinds",
    heroSeats: ["SB", "BB"],
    vsLabel: "a cutoff or button opener",
    fivebet: ["AA", "KK", "AKs", "A5s"],
    call: ["JJ", "QQ", "AKo", "AQs"],
  },
};

// ---------------------------------------------------------------------------
// 6. Someone opened and someone else called — squeeze, call, or fold.
//    Always tighter than 3-betting the same opener heads-up: there is a second
//    player already committed, so bluffs get through less often and the caller's
//    range is capped but real. check-ranges.js asserts that relationship.
// ---------------------------------------------------------------------------

const SQUEEZE_OPENER = {
  EP: { label: "early position" },
  MP: { label: "middle position" },
  LATE: { label: "the cutoff or button" },
};

const SQUEEZE = {
  IP: {
    heroLabel: "in position behind the caller",
    heroSeats: ["HJ", "CO", "BTN"],
    EP: { squeeze: ["QQ+", "AKs", "AKo"],
          call: ["99-JJ", "AQs", "AJs", "KQs", "QJs", "JTs"] },
    MP: { squeeze: ["JJ+", "AKs", "AKo", "AQs"],
          call: ["77-TT", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "T9s"] },
    LATE: { squeeze: ["TT+", "AKs", "AQs", "AJs", "A5s", "AKo"],
            call: ["55-99", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s"] },
  },
  SB: {
    heroLabel: "in the small blind",
    heroSeats: ["SB"],
    EP: { squeeze: ["QQ+", "AKs", "AKo"], call: ["TT-JJ", "AQs"] },
    MP: { squeeze: ["JJ+", "AKs", "AKo", "AQs"], call: ["99-TT", "AJs", "KQs"] },
    LATE: { squeeze: ["TT+", "AKs", "AQs", "AJs", "A5s", "AKo"],
            call: ["77-99", "ATs", "KQs", "KJs", "QJs"] },
  },
  BB: {
    heroLabel: "in the big blind",
    heroSeats: ["BB"],
    EP: { squeeze: ["QQ+", "AKs", "AKo", "A5s"],
          call: ["66-JJ", "AQs", "AJs", "ATs", "KQs", "KJs", "QJs", "JTs", "T9s"] },
    MP: { squeeze: ["JJ+", "AKs", "AKo", "AQs", "A5s"],
          call: ["44-TT", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs",
                 "T9s", "98s"] },
    LATE: { squeeze: ["TT+", "AKs", "AQs", "AJs", "AKo", "A4s", "A5s"],
            call: ["22-99", "A6s-ATs", "K9s-KQs", "Q9s-QJs", "J9s-JTs", "T9s", "98s", "87s", "76s"] },
  },
};

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
      notation: { fivebet: entry.fivebet, call: entry.call },
      sets: { fivebet: expand(entry.fivebet), call: expand(entry.call) },
      actions: ["fivebet", "call", "fold"],
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
  RFI, VS_OPEN, VS_LIMP, VS_3BET, VS_4BET, SQUEEZE, SPOTS,
  expand, expandToken, combosOf, percentOf,
};
