# Full Ring Opening Ranges

A 9-max preflop RFI trainer. One self-contained HTML page, no build step and no
dependencies to install.

| File | What |
|---|---|
| `trainer.src.html` | The page. Edit this one. |
| `trainer.html` | Built output — pure ASCII, safe to serve anywhere. |
| `ranges.js` | The range data as a Node module, for the checks below. |
| `check-ranges.js` | Coherence checks on the ranges themselves. |
| `check-page.js` | Guards the page's ranges against drifting from `ranges.js`. |
| `build.js` | Escapes every non-ASCII character and writes `trainer.html`. |

```bash
node check-ranges.js   # ranges widen with position, nesting holds, no trash early
node check-page.js     # the page drills exactly what was checked
node build.js          # rebuild trainer.html after editing trainer.src.html
```

## About the ranges

A consensus teaching baseline for 9-max cash at 100bb — close to what most
full-ring charts agree on. **Not solver output**, and not claimed to be optimal.
The page says so too.

| | UTG | UTG+1 | UTG+2 | LJ | HJ | CO | BTN | SB |
|---|---|---|---|---|---|---|---|---|
| % of hands | 9.5 | 11.8 | 14.6 | 17.2 | 21.0 | 27.3 | 44.2 | 39.7 |

`check-ranges.js` asserts the properties that make a chart set coherent: ranges
widen from UTG to the button, nothing opened from an early seat is folded from a
later one, premiums open everywhere, and no trash opens from a non-blind seat.

## Why ASCII

The card suits are `♠` and friends. Served without a declared charset they
turn into mojibake, so `build.js` escapes every non-ASCII character rather than
depending on a `<meta charset>` that may not survive.
