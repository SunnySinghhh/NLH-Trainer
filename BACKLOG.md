# Backlog

Deprioritised, but worth doing. Each entry notes what it actually costs, so
future-me does not underestimate it.

## Opponent opening sizes

Whatever open size the new ranges get written against needs **stating out loud**
in the provenance panel. On the previous data set it was ~2.5bb, baked in and
invisible to the user - someone drilling that and then sitting in a live game
facing 5bb opens was being taught the wrong defence. Decide the size before
writing the defending ranges, not after.

Facing a bigger open you defend **tighter** (worse price, deeper effective
stack-to-pot); facing a min-raise you defend **much wider**. The effect is large
enough to change whether marginal hands are calls at all.

- Touches every `vsopen`, `vs3bet` and `squeeze` range — not an additive layer,
  a multiplier on the ones that exist.
- Realistic sizes to support: 2bb (online min-raise), 2.5bb (baseline, current),
  3bb, 4bb+ (live).
- Cheapest honest first step: state the 2.5bb assumption in the UI, then add a
  size selector that adjusts the *calling* range only, since 3-bet ranges move
  less with size than calling ranges do.

## Table size: 6-max

A second full set of ranges. 6-max positions are UTG / HJ / CO / BTN / SB / BB,
and every range is wider than its full-ring equivalent because there are fewer
players left to act.

- Cannot be derived from the 9-max charts by dropping seats — the whole ladder
  shifts.
- Roughly doubles the range data (about 60 more spots at current coverage).
- The app is already scenario-driven, so the UI cost is a game-type selector;
  the cost is the data.

## Stack depths

Everything here is **100bb**. Depth changes preflop strategy sharply:

- **Short (30-50bb):** 4-bets become shoves, 3-bet-calling ranges collapse,
  suited connectors lose value (no implied odds).
- **Deep (200bb+):** more flatting, more suited playability, 4-bet bluffs get
  riskier.
- Another full set of ranges per depth, so this and 6-max multiply together.
  Pick one axis at a time.

## Smaller things

- **Straddles and antes** — common live, changes effective position and pot odds.
- **Exact position pairs instead of buckets** — LJ vs UTG and LJ vs UTG+2 share
  a chart today. More faithful, but ~150-250 ranges with no structural check on
  most of them (see the note in README about why bucketing was chosen).
- **Spaced repetition** — surface hands you have got wrong before more often,
  rather than uniform random.
