# Backlog

Deprioritised, but worth doing. Each entry notes what it actually costs, so
future-me does not underestimate it.

## User-supplied ranges

Let someone paste in their own ranges and drill those instead of the ones
shipped here. The most valuable thing on this list, and the one that changes
the architecture most.

- The data model already fits: a spot is `(seat, facing)` with per-hand
  frequencies, which is what every range tool exports.
- **Input format** is the real decision. Options, cheapest first:
  - the notation this repo already uses (`QQ+`, `A2s-A5s`, `TT: raise 50`);
  - weighted strings from solver tools (`AA:1,AKs:1,A5s:0.25`), which is what
    people will actually have on the clipboard;
  - a clickable 13x13 grid, which is the nicest to use and the most work.
- **Where it lives.** Ranges pasted into a page served from GitHub Pages have
  nowhere to persist but the browser. `localStorage` per viewer is the honest
  answer; anything shared needs a backend.
- Needs an import/export round trip, or people will lose work they typed in.
- The checks would have to become advisory rather than build-time: someone
  else's ranges are allowed to disagree with the position ladder here.

## Opponent opening sizes

Whatever open size the ranges are written against needs **stating out loud**,
which the provenance panel now does (~2.5bb). Making it selectable is the next
step: facing a bigger open you defend tighter, facing a min-raise much wider,
and the effect is large enough to change whether marginal hands are calls at
all.

- Touches every non-RFI range - a multiplier on the ones that exist, not an
  additive layer.
- Realistic sizes: 2bb (online min-raise), 2.5bb (baseline), 3bb, 4bb+ (live).
- Cheapest honest first step is to adjust the *calling* range only, since
  raising ranges move less with size than calling ranges do.

## The small blind

Deliberately absent - the source simulation does not cover it. The seat already
exists in `SEATS` and is skipped only because it is not in `TESTED_SEATS`, so
adding it is purely a data job whenever ranges exist for it.

## Other table sizes

Everything here is 8-handed. 6-max and 9-max are each a full second set of
ranges; the ladder shifts rather than a seat being dropped, so they cannot be
derived from these by adding or removing positions. The app is already
data-driven, so the cost is the ranges, not the UI.

## Stack depths

Everything is **100bb**.

- **Short (30-50bb):** 4-bets become shoves, calling ranges collapse, suited
  connectors lose their implied odds.
- **Deep (200bb+):** more flatting, more suited playability, riskier 4-bet
  bluffs.
- Another full set of ranges per depth, and this multiplies with table size.
  Pick one axis at a time.

## Smaller things

- **Straddles and antes** - common live, changes effective position and pot odds.
- **Spaced repetition** - surface hands you have got wrong before more often,
  rather than uniform random.
- **Persist session stats** across reloads, which today reset with the page.
- **Track roll-spot accuracy separately.** Mixed hands are the hardest part and
  are currently pooled with the rest in the stats.
