# Preflop Range Trainer

A 9-max full ring preflop trainer. One self-contained HTML page — no build
step to run it, no dependencies to install.

Three scenarios, 32 spots:

| Scenario | Your actions |
|---|---|
| It folds to you | Raise / Fold — plus **Complete** in the small blind |
| Someone raises ahead of you | 3-Bet / Call / Fold |
| Someone limps ahead of you | Raise / Call / Fold — or Raise / **Check** in the big blind |

## Files

| File | What |
|---|---|
| `ranges.js` | **The range data — the single source of truth.** |
| `trainer.src.html` | The page. Edit this one. |
| `trainer.html` | Built output: data injected, pure ASCII. |
| `check-ranges.js` | Coherence checks on the ranges. |
| `build.js` | Injects the data and escapes non-ASCII. |

```bash
node check-ranges.js   # 10 coherence checks, prints every range's percentages
node build.js          # rebuild trainer.html
```

The data lives in exactly one place and is injected at build time, so the page
can never drill something different from what the checks validate.

## About the ranges

A consensus teaching baseline for 9-max cash at 100bb. **Not solver output**,
and not claimed to be optimal — the page says so too.

The opponent's seat is bucketed into early / middle / cutoff / button / small
blind, which is how these charts are normally taught. A real solver would treat
every exact pairing separately; bucketing keeps the number of distinct ranges
to something that can actually be checked by hand rather than 250 charts typed
from memory.

### Opening ranges (folded to you)

| | UTG | UTG+1 | UTG+2 | LJ | HJ | CO | BTN | SB |
|---|---|---|---|---|---|---|---|---|
| open | 9.5% | 11.8% | 14.6% | 17.2% | 21.0% | 27.3% | 44.2% | 39.7% |
| complete | — | — | — | — | — | — | — | 16.3% |

Only the small blind gets a completing range. It is the one seat offered a
half-blind price to close the action against a single opponent. Everyone else
calling here would be open-limping into a field with players still to act,
which is not part of these charts.

### Total defence facing a raise

| | vs EP | vs MP | vs CO | vs BTN | vs SB |
|---|---|---|---|---|---|
| BTN | 8.3% | 11.8% | 14.6% | — | — |
| SB | 4.4% | 5.4% | 7.2% | 13.4% | — |
| BB | 13.7% | 18.6% | 25.2% | 39.1% | 49.3% |

## What the checks establish

None of them prove the ranges are optimal — nothing could. They catch a chart
that contradicts itself or contradicts position:

1. Every hand named is one of the 169 real starting hands
2. No hand is assigned two different actions in the same spot
3. No spot plays more than 100% of hands
4. Aces and kings are always raised, never just called or folded
5. Opening ranges widen from UTG to the button, and nothing opened early is
   folded from a later seat
6. Defence widens as the raise comes from a later seat
7. The big blind defends wider than the small blind against the same raise
8. The big blind never folds to a limp
9. Isolation ranges widen from early position to the button
10. Only the small blind can complete when the action folds to it
11. The small blind completes hands it is not already opening, and does not end
    up playing an absurd share of them
12. Trash never opens from a seat that is not the button or a blind

Two real errors these caught during the build: `KJo` assigned to both the
3-bet and the call range for BB vs SB, and the small blind defending only
10.6% against a button that opens 44%.

## Why the ASCII step

The card suits are `♠` and friends. Served without a declared charset they turn
into mojibake, so `build.js` escapes every non-ASCII character rather than
depending on a `<meta charset>` that may not survive.
