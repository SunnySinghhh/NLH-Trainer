# Preflop NLH Range Trainer

An 8-handed preflop trainer. One self-contained HTML page - no build step to
run it, no dependencies to install, nothing to serve it from.

**Live page:** `index.html` at the repo root, ready for GitHub Pages.

## The model

A spot is a **position** and an **action to you**. That is the whole thing.

```
You're under the gun. The action to you is a 3-bet. Raise, call, fold or check?
```

Nothing tracks who did what to get there. UTG can be facing a 3-bet because it
opened and someone 3-bet, or because it called and two players raised behind -
the answer is the same either way, so the trainer does not ask.

Every spot offers the same four options - **raise, call, fold, check** -
including where an option is not legal. Checking into a 4-bet is not a thing
you can do; it is on the board anyway, so the choice is made out of the whole
set rather than one that has already been narrowed for you.

### The roll

Some hands are not played the same way every time. Those hands carry
frequencies, and the trainer resolves them with a **1-100 roll** rather than
picking a favourite:

```
fold   |   call   |   raise   |   check
1 -------------------------------------- 100
```

TT facing a 3-bet from UTG is call 50% / raise 50%, so it calls on 1-50 and
raises on 51-100. A hand that folds 80% and raises 20% folds on 1-80.

**Every hand gets a roll, not just the mixed ones.** Rolling only when it
mattered would tell you a hand was mixed before you had to decide.

### Table

Eight seats: `UTG MP LJ HJ CO BTN SB BB`. Seven get drilled - the **small
blind is at the table but never the hero**, because the simulation these ranges
come from does not cover it.

Two seat/facing pairs can never happen and are not treated as gaps:

- **BB / RFI** - the big blind is never folded to.
- **A raise-or-fold seat / Open** - if a seat never limps, it can never end up
  facing an open. This is why UTG has three columns and not four.

## Using it

**Drill tab.** Filter by position and action to you - each group has All and
None, and a group may be emptied. **Hands** narrows what gets dealt: mixed-only
drills just the frequency spots, which are the hardest part and otherwise come
up rarely. **Timer** gives you 3 to 30 seconds per decision; running out counts
as a miss. Session stats survive a reload.

**Charts tab.** Pick a spot with the two dropdowns. Tap any cell for its exact
frequencies and roll bands - the only way to see them on a phone, which has no
hover. **Drill this spot** jumps to the Drill tab filtered to it. On an opening
range, **What X adds over Y** outlines the hands this seat opens that the seat
before it does not, which is the shape of position made visible. **Print all**
lays out all 27 charts for paper.

Every chart has its own URL: `#BTN/open` opens that chart directly.

## Files

| File | What |
|---|---|
| `ranges.js` | **The range data - the single source of truth.** |
| `trainer.src.html` | The page. Edit this one. |
| `index.html` | Built output: data injected, pure ASCII. Do not edit. |
| `check-ranges.js` | Coherence checks on the ranges. |
| `build.js` | Injects the data and escapes non-ASCII. |

```bash
node check-ranges.js   # what holds, what fails, what is skipped for want of data
node build.js          # rebuild index.html
```

The data lives in exactly one place and is injected at build time, so the page
can never drill something different from what the checks validate.

## Adding a spot

Fill in an entry in `RANGES`, keyed by seat and then by what is facing you:

```js
UTG: {
  threebet: {
    raise: ["QQ+", "AKs", "A2s-A5s"],   // 100% of the time
    call:  ["99", "AQo", "KQo"],        // 100% of the time
    mix: {                              // the rest of each hand folds
      "TT":  { raise: 50, call: 50 },
      "77":  { raise: 55 },             // and folds the other 45%
      "AJs": { call: 70 },
    },
  },
}
```

Notation is standard - `66+`, `88-JJ`, `ATs+`, `A2s-A5s`, `AJo+`, `T9s` - and
works as a `mix` key too. Anything not named anywhere folds every time.

Then `node check-ranges.js` and `node build.js`. Scenarios and positions appear
in the UI only when they have data, so a half-filled `ranges.js` gives a working
trainer over exactly the spots that exist. It is safe to build one position at
a time.

## What the checks establish

None of them prove a range is optimal - nothing could. They catch a chart that
contradicts itself or contradicts position: hands that are not real hands,
frequencies that add to more than 100%, roll bands with gaps or in the wrong
order, aces getting folded, opening ranges that fail to widen and nest from
under the gun to the button, continuing ranges that get wider against a 4-bet
than against a 3-bet, and trash opening from early position.

A check with no data to run against reports as **skipped**, not passed, so a
half-filled `ranges.js` never reads as a clean bill of health. The run also
prints every mixed hand with its frequencies and its roll bands, which is the
fastest way to eyeball whether the estimates match the source charts.

## About the ranges

Read off chart images and **estimated where cells are split by frequency**.
Written against **8-handed, 100bb, a ~2.5bb open, no ante or straddle**. Facing
larger opens you should defend tighter than this; facing min-raises, wider.

## Why the ASCII step

The card suits are non-ASCII. Served without a declared charset they turn into
mojibake, so `build.js` escapes every non-ASCII character rather than depending
on a `<meta charset>` that may not survive.
