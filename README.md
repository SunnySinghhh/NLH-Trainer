# Preflop Range Trainer

A 9-max full ring preflop trainer. One self-contained HTML page - no build step
to run it, no dependencies to install.

**The range data is currently empty.** The trainer, the checks and the build
step are all intact; the ranges are being written from scratch, one position
and one spot at a time. Until a table is filled in, the page says so rather
than pretending to drill something.

## Files

| File | What |
|---|---|
| `ranges.js` | **The range data - the single source of truth.** Currently empty. |
| `trainer.src.html` | The page. Edit this one. |
| `trainer.html` | Built output: data injected, pure ASCII. Do not edit. |
| `check-ranges.js` | Coherence checks on the ranges. |
| `build.js` | Injects the data and escapes non-ASCII. |

```bash
node check-ranges.js   # what holds, what fails, what is skipped for want of data
node build.js          # rebuild trainer.html
```

The data lives in exactly one place and is injected at build time, so the page
can never drill something different from what the checks validate.

## Adding a spot

1. **Fill in a table in `ranges.js`.** Each one carries a comment showing the
   exact shape it expects. Ranges are written in standard notation - `66+`,
   `88-JJ`, `ATs+`, `A2s-A5s`, `AJo+`, `T9s` - and expanded programmatically.
2. **Run `node check-ranges.js`.** Anything structurally wrong shows up here.
3. **Run `node build.js`.** Open `trainer.html`.

Scenarios appear in the UI only when they have spots. A half-filled `ranges.js`
gives a working trainer over exactly the spots that exist, so it is safe to
build one position at a time.

## The scenarios the page knows how to render

Each maps to one table in `ranges.js`. An empty table means the scenario is
hidden, not broken.

| Scenario | Your actions | Table |
|---|---|---|
| It folds to you | Raise / Fold, plus Limp or Complete where offered | `RFI` |
| Someone raised ahead of you | 3-Bet / Call / Fold | `VS_OPEN` |
| It got 3-bet before it reached you | Cold 4-Bet / Call / Fold | `COLD_3BET` |
| You opened and got 3-bet | 4-Bet / Call / Fold | `VS_3BET` |
| A 4-bet is on you | 5-Bet / Call / Fold | `VS_4BET` |
| Someone opened and someone called | Squeeze / Call / Fold | `SQUEEZE` |
| Limped to you, one or many | Isolate / Overlimp / Fold, or Check in the BB | `VS_LIMP` |

Two of these have a wrinkle worth remembering while writing the theory:

- **`VS_4BET` covers two different spots.** Normally you 3-bet and the original
  raiser came back over the top. But an opener can also face a **cold 4-bet**
  without ever 3-betting: you open, someone behind you 3-bets, a third player
  4-bets. Every seat can reach that version, under the gun included - and in it
  the 3-bettor still has a decision left behind you. Mark those entries `cold`.
- **Under the gun can never 3-bet**, because nobody opens ahead of it. It can
  still be 4-bet, by the route above.

## What the checks establish

None of them prove a range is optimal - nothing could. They catch a chart that
contradicts itself or contradicts position: no hand given two actions, opening
ranges widening from under the gun to the button and nesting as they go,
defence widening against later raises, the big blind defending wider than the
small blind, 4-bets far tighter than the opens that invite them, squeezes
tighter than 3-betting the same opener heads-up, and so on.

A check with no data to run against reports as **skipped**, not passed, so a
half-filled `ranges.js` never reads as a clean bill of health.

Some checks encode opinions about chart shape that were written for the
previous data set. As the new ranges go in, a check that fights a deliberate
choice should be changed or removed rather than worked around - it is there to
express the theory, not to outrank it.

## Why the ASCII step

The card suits are non-ASCII. Served without a declared charset they turn into
mojibake, so `build.js` escapes every non-ASCII character rather than depending
on a `<meta charset>` that may not survive.
