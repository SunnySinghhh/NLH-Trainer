/**
 * Preflop range data - the single source of truth.
 *
 * The model is deliberately flat. A spot is a POSITION and an ACTION TO YOU:
 *
 *     UTG, and the action to you is a 3-bet.
 *
 * Nothing tracks who did what to get there. UTG can be facing a 3-bet because
 * it opened and someone 3-bet, or because it called and two players raised
 * behind - the right answer is the same either way, so the trainer does not
 * ask. Options offered are always the same four: raise, call, fold, check.
 *
 * Notation:
 *   "66+"       every pocket pair from sixes up
 *   "88-JJ"     pocket pairs between eights and jacks
 *   "ATs+"      ATs, AJs, AQs, AKs   (fix the ace, walk the kicker up)
 *   "A2s-A5s"   A2s through A5s
 *   "AJo+"      AJo, AQo, AKo
 *   "T9s"       exactly that hand
 *
 * MIXED HANDS. A hand that is not played the same way every time goes in
 * `mix`, with the percentage of the time each action is taken. Whatever is
 * left over folds. The trainer resolves these with a 1-100 roll rather than
 * picking a favourite, so the player drills the frequency itself.
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

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/** Every seat at an 8-handed table, in order of preflop action. */
const SEATS = ["UTG", "MP", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

const SEAT_NAMES = {
  UTG: "under the gun",
  MP: "middle position",
  LJ: "the lojack",
  HJ: "the hijack",
  CO: "the cutoff",
  BTN: "the button",
  SB: "the small blind",
  BB: "the big blind",
};

/**
 * The seats that get drilled. The small blind is deliberately absent - the
 * simulation these ranges come from does not cover it - so it sits at the
 * table but is never the hero.
 */
const TESTED_SEATS = ["UTG", "MP", "LJ", "HJ", "CO", "BTN", "BB"];

/** The four things that can be facing you, in the order they escalate. */
const FACING = {
  rfi: { label: "RFI", full: "it folds to you" },
  open: { label: "Open", full: "an open" },
  threebet: { label: "3 bet", full: "a 3-bet" },
  fourbet: { label: "4 bet", full: "a 4-bet" },
};

/**
 * Every option is offered in every spot, whether or not it is legal. Checking
 * facing a 4-bet is not a thing you can do; it is on the board anyway, because
 * the point is to pick the right action out of the whole set rather than out
 * of a set that has already been narrowed for you.
 */
const OPTIONS = ["raise", "call", "fold", "check"];

/**
 * How a mixed hand maps onto a 1-100 roll: fold at the bottom, then call, then
 * raise, then check. So a hand that calls 50% and raises 50% calls on 1-50 and
 * raises on 51-100; a hand that folds 70% and raises 30% folds on 1-70.
 */
const RNG_ORDER = ["fold", "call", "raise", "check"];

// ---------------------------------------------------------------------------
// Ranges, by seat and by what is facing you.
//
//   SEAT: {
//     rfi | open | threebet | fourbet: {
//       raise: [tokens],   // 100% of the time
//       call:  [tokens],   // 100% of the time
//       check: [tokens],   // 100% of the time
//       mix:   { token: { raise: n, call: n, check: n } },   // rest folds
//     }
//   }
//
// Anything not named anywhere folds 100% of the time. A seat with no entry for
// a facing action simply never produces that spot: UTG has no `open` range
// because with a raise-or-fold RFI it can never be facing an open.
// ---------------------------------------------------------------------------

const RANGES = {
  UTG: {
    rfi: {
      raise: ["77+", "ATs+", "KTs+", "QTs+", "JTs", "T9s", "98s", "AJo+", "KQo"],
      mix: {
        "A9s": { raise: 50 },
        "A2s-A5s": { raise: 20 },
        "ATo": { raise: 50 },
        "KJo": { raise: 50 },
      },
    },

    threebet: {
      raise: ["QQ+", "AKs", "A2s-A5s"],
      call: ["99", "AQo", "KQo", "T9s", "98s"],
      mix: {
        "AKo": { raise: 85, call: 15 },
        "AQs": { raise: 50, call: 50 },
        "KQs": { raise: 20, call: 80 },
        "JJ": { raise: 55, call: 45 },
        "TT": { raise: 50, call: 50 },
        // The only hand here played three ways: the rest of each entry folds.
        "88": { raise: 10, call: 50 },
        "77": { raise: 10 },
        "AJs": { call: 50 },
        "KJs": { call: 50 },
        "QJs": { call: 50 },
      },
    },

    fourbet: {
      raise: ["QQ+"],
      call: ["JJ", "TT", "AKs", "AKo"],
    },
  },

  MP: {
    rfi: {
      raise: [
        "77+", "A9s+", "A2s-A5s", "KTs+", "QTs+", "JTs", "T9s", "98s", "87s",
        "AJo+", "ATo", "KQo",
      ],
      mix: {
        "A8s": { raise: 35 },
        "K9s": { raise: 25 },
        "76s": { raise: 45 },
        "66": { raise: 45 },
        "KJo": { raise: 50 },
        "A9o": { raise: 20 },
      },
    },

    open: {
      raise: ["99+", "AKs", "AQs", "AJs", "KQs", "AKo", "AQo"],
      call: ["A9s", "KJs", "KQo", "88"],
      mix: {
        "ATs": { raise: 55, call: 45 },
        "A5s": { raise: 25 },
        "A4s": { raise: 25 },
        "QJs": { call: 30 },
        "AJo": { raise: 55, call: 45 },
        "JTs": { raise: 55, call: 45 },
        "T9s": { raise: 50, call: 50 },
        "98s": { raise: 45, call: 55 },
        "87s": { raise: 45, call: 55 },
        "77": { raise: 30, call: 70 },
      },
    },

    threebet: {
      raise: ["QQ+", "AKs", "A5s"],
      call: ["AJs", "ATs", "AQo", "KQo", "T9s", "99", "98s", "87s"],
      mix: {
        "AKo": { raise: 80, call: 20 },
        "AQs": { raise: 60, call: 40 },
        "KQs": { raise: 40, call: 60 },
        "A4s": { raise: 85 },
        "A3s": { raise: 25 },
        "A2s": { raise: 25 },
        "JJ": { raise: 55, call: 45 },
        "TT": { raise: 50, call: 50 },
        "88": { raise: 25, call: 75 },
        "77": { raise: 30 },
        "KJs": { call: 25 },
        "QJs": { call: 25 },
        "AJo": { call: 40 },
      },
    },

    // No 5-bet at all: facing a 4-bet this seat calls or folds, aces included.
    fourbet: {
      call: ["TT+", "AKs", "AKo"],
    },
  },

  LJ: {
    rfi: {
      raise: [
        "77+", "A9s+", "A2s-A5s", "KTs+", "QTs+", "JTs", "T9s", "98s", "87s",
        "AJo+", "ATo", "KQo",
      ],
      mix: {
        "A8s": { raise: 40 },
        "K9s": { raise: 45 },
        "Q9s": { raise: 40 },
        "J9s": { raise: 50 },
        "76s": { raise: 50 },
        "65s": { raise: 55 },
        "66": { raise: 55 },
        "55": { raise: 50 },
        "KJo": { raise: 55 },
        "A9o": { raise: 45 },
      },
    },

    open: {
      raise: ["99+", "AKs", "AQs", "AJs", "KQs", "AKo", "AQo"],
      call: ["A9s", "KJs", "KQo", "88"],
      mix: {
        "ATs": { raise: 55, call: 45 },
        "A5s": { raise: 25 },
        "A4s": { raise: 25 },
        "QJs": { call: 35 },
        "ATo": { call: 40 },
        "AJo": { raise: 55, call: 45 },
        "JTs": { raise: 55, call: 45 },
        "T9s": { raise: 50, call: 50 },
        "98s": { raise: 45, call: 55 },
        "87s": { raise: 45, call: 55 },
        "77": { raise: 30, call: 70 },
      },
    },

    threebet: {
      raise: ["QQ+", "AKs", "A5s"],
      call: ["AJs", "ATs", "AQo", "KQo", "T9s", "99", "98s", "88", "87s"],
      mix: {
        "AKo": { raise: 80, call: 20 },
        "AQs": { raise: 60, call: 40 },
        "KQs": { raise: 40, call: 60 },
        "A4s": { raise: 85 },
        "A3s": { raise: 25 },
        "A2s": { raise: 25 },
        "JJ": { raise: 55, call: 45 },
        "TT": { raise: 50, call: 50 },
        "77": { raise: 30 },
        "66": { raise: 20 },
        "KJs": { call: 25 },
        "QJs": { call: 25 },
        "AJo": { call: 40 },
      },
    },

    fourbet: {
      call: ["TT+", "AKs", "AKo"],
    },
  },

  HJ: {
    rfi: {
      raise: [
        "77+", "A9s+", "A2s-A5s", "KTs+", "QTs+", "JTs", "T9s", "98s", "87s",
        "AJo+", "ATo", "KQo", "KJo",
      ],
      mix: {
        "A8s": { raise: 45 },
        "A7s": { raise: 35 },
        "A6s": { raise: 30 },
        "K9s": { raise: 50 },
        "Q9s": { raise: 50 },
        "J9s": { raise: 55 },
        "76s": { raise: 55 },
        "65s": { raise: 55 },
        "66": { raise: 55 },
        "55": { raise: 55 },
        "44": { raise: 50 },
        "KTo": { raise: 45 },
        "A9o": { raise: 55 },
        "A8o": { raise: 50 },
        "A7o": { raise: 50 },
      },
    },

    open: {
      raise: ["99+", "AKs", "AQs", "AJs", "KQs", "AQo"],
      call: ["A9s", "KJs", "KQo", "ATo", "88", "77"],
      mix: {
        "AKo": { raise: 80, call: 20 },
        "ATs": { raise: 55, call: 45 },
        "A5s": { raise: 30 },
        "A4s": { raise: 30 },
        "QJs": { call: 35 },
        "AJo": { raise: 55, call: 45 },
        "JTs": { raise: 55, call: 45 },
        "T9s": { raise: 50, call: 50 },
        "98s": { raise: 45, call: 55 },
        "87s": { raise: 45, call: 55 },
        "66": { raise: 25 },
      },
    },

    threebet: {
      raise: ["QQ+", "AKs", "A5s"],
      call: ["AJs", "KQo", "T9s", "99", "98s", "88", "87s"],
      mix: {
        "AKo": { raise: 85, call: 15 },
        "AQs": { raise: 60, call: 40 },
        "KQs": { raise: 40, call: 60 },
        "AQo": { raise: 25, call: 75 },
        "A4s": { raise: 85 },
        "A3s": { raise: 25 },
        "A2s": { raise: 25 },
        "JJ": { raise: 55, call: 45 },
        "TT": { raise: 50, call: 50 },
        "77": { raise: 30 },
        "66": { raise: 20 },
        "ATs": { call: 55 },
        "KJs": { call: 30 },
        "QJs": { call: 25 },
        "AJo": { call: 40 },
      },
    },

    fourbet: {
      call: ["TT+", "AKs", "AKo"],
    },
  },
};

// ---------------------------------------------------------------------------
// Building the spot list
// ---------------------------------------------------------------------------

/**
 * Turn one range entry into a hand -> {action: percent} map. Every hand that
 * is played at all appears; everything else is an implicit 100% fold.
 */
function weightsOf(entry) {
  const weights = {};
  const put = (hand, action, pct) => {
    if (!weights[hand]) weights[hand] = {};
    if (weights[hand][action]) {
      throw new Error(`${hand} is given ${action} twice`);
    }
    weights[hand][action] = pct;
  };

  for (const action of OPTIONS) {
    if (action === "fold" || !entry[action]) continue;
    for (const hand of expand(entry[action])) {
      if (weights[hand]) throw new Error(`${hand} appears in more than one action`);
      put(hand, action, 100);
    }
  }

  for (const token of Object.keys(entry.mix || {})) {
    const spread = entry.mix[token];
    for (const hand of expandToken(token)) {
      if (weights[hand]) throw new Error(`${hand} is both mixed and pure`);
      for (const action of Object.keys(spread)) put(hand, action, spread[action]);
    }
  }

  return weights;
}

/**
 * The 1-100 bands for one hand. The last band is stretched to 100 so rounding
 * can never leave a gap a roll could land in.
 */
function bandsOf(spread) {
  const bands = [];
  let lo = 1;
  let fold = 100;
  for (const action of RNG_ORDER) fold -= spread[action] || 0;
  const all = { fold: Math.max(0, fold), ...spread };

  for (const action of RNG_ORDER) {
    const pct = all[action] || 0;
    if (pct <= 0) continue;
    const hi = Math.min(100, lo + Math.round(pct) - 1);
    bands.push({ action, lo, hi });
    lo = hi + 1;
    if (lo > 100) break;
  }
  if (bands.length) bands[bands.length - 1].hi = 100;
  return bands;
}

/** Share of all 1326 combos taken by one action, honouring mixed frequencies. */
function percentOf(weights, action) {
  let combos = 0;
  for (const hand of Object.keys(weights)) {
    const pct = weights[hand][action] || 0;
    if (pct) combos += (combosOf(hand) * pct) / 100;
  }
  return (100 * combos) / 1326;
}

function buildSpots() {
  const spots = [];

  for (const seat of TESTED_SEATS) {
    const bySeat = RANGES[seat];
    if (!bySeat) continue;

    for (const facing of Object.keys(FACING)) {
      const entry = bySeat[facing];
      if (!entry) continue;

      const weights = weightsOf(entry);
      const bands = {};
      let mixed = 0;
      for (const hand of Object.keys(weights)) {
        bands[hand] = bandsOf(weights[hand]);
        if (bands[hand].length > 1) mixed += 1;
      }

      const pct = {};
      for (const action of OPTIONS) {
        const share = percentOf(weights, action);
        if (share > 0) pct[action] = Number(share.toFixed(2));
      }
      pct.fold = Number(
        (100 - OPTIONS.filter((a) => a !== "fold").reduce((t, a) => t + (pct[a] || 0), 0)).toFixed(2),
      );

      spots.push({
        id: `${seat}-${facing}`,
        seat,
        seatName: SEAT_NAMES[seat],
        facing,
        facingLabel: FACING[facing].label,
        facingFull: FACING[facing].full,
        notation: {
          raise: entry.raise || [],
          call: entry.call || [],
          check: entry.check || [],
          mix: entry.mix || {},
        },
        weights,
        bands,
        mixedCount: mixed,
        pct,
      });
    }
  }

  return spots;
}

const SPOTS = buildSpots();

module.exports = {
  RANKS, SEATS, SEAT_NAMES, TESTED_SEATS, FACING, OPTIONS, RNG_ORDER, RANGES, SPOTS,
  expand, expandToken, combosOf, weightsOf, bandsOf, percentOf,
};
