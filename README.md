# NLH Trainer

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

**Pre Flop Range Trainer tab.** Filter by position and action to you - each group has All and
None, and a group may be emptied. **Hands** narrows what gets dealt: mixed-only
drills just the frequency spots, which are the hardest part and otherwise come
up rarely. **Timer** gives you 3 to 30 seconds per decision; running out counts
as a miss. Session stats survive a reload.

**Pre Flop Range Charts tab.** Pick a spot with the two dropdowns. Tap any cell for a popup pinned
to it showing its exact frequencies and roll bands - the only way to see them
on a phone, which has no hover. **Drill this spot** jumps to the Drill tab filtered to it. On an opening
range, **What X adds over Y** outlines the hands this seat opens that the seat
before it does not, which is the shape of position made visible. **Print all**
lays out all 27 charts for paper.

**Pot Odds Trainer tab.** A math test. Five question types, each generating fresh
numbers: the equity you need to call a bet, the same facing a raise, pot odds
as a ratio, how often a bluff must work, and outs to equity. **Call or fold**
is the composite - you get the pot, the bet, your outs and the street, and
have to work out both the equity and the price yourself before deciding.
Answers are typed, graded on a tolerance you pick from Exact to +/-5, and
every verdict shows the working.

Two of the types deal **real cards** - your hand plus a flop or a turn - and
make you count the outs yourself before doing anything with them. **Count your
outs** asks for the number; **Cards: call or fold** gives you the pot and the
bet as well, so you have to reach the outs, the equity and the price before
deciding. The arithmetic types can also put **callers** in the pot, which
changes the price: one caller turns a half-pot bet from 25% into 20%.

Each question carries a line under its heading saying what that type is
training - the skill, not the answer - so the point of the exercise is on
screen rather than inferred.

A timer is available here too, at 10 to 60 seconds - longer than the range
drill's, because arithmetic takes longer than recall.

Some deliberate choices in there:

- **Ratio answers are graded by converting to equity**, so `3:1` becomes 25%
  and is judged on the same tolerance as everything else. `3:1`, `3 to 1`,
  `3-1` and a bare `3` all parse the same, which keeps awkward ratios like
  4.33:1 answerable.
- **Outs questions accept either** the rule-of-2-and-4 answer or the exact
  one. The rule drifts as outs go up - 15 outs is 60% by the rule and 54% in
  fact - and both are worth knowing, so the feedback prints both.
- **Call-or-fold spots are generated on the turn**, one card to come, and only
  when the margin is at least 4 points. One card avoids hand-waving about
  seeing the river cheaply; the margin stops the answer being a coin flip.
- **Out counts are graded exactly**, whatever the tolerance is set to. A count
  of outs is a count, not an estimate.
- **A card that makes the board itself into a flush or a straight is not an
  out**, because it plays for everyone. Those are excluded from the count.
- **Flop spots have villain all in.** Otherwise the price does not actually
  buy both cards - there is a turn bet coming - and the rule of 4 overstates
  your equity. All in, both cards come for the one price and the number is
  honest.
- **Multiway card spots are nut flush draws only.** Extra callers change the
  price by exact arithmetic, but "I hit and I win" stops being fair once there
  are three of you - except on a draw to the nuts, where it holds. Every other
  shape stays heads up. See BACKLOG for why the general case is not shipped.
- **Call and fold come up about equally.** Left to chance this question folded
  essentially every time: on the turn a nine-out draw is 19.6% and the smallest
  bet already asks 20%, so a call was close to arithmetically impossible. The
  generator now aims at an answer and searches for a spot that produces it.

Every chart has its own URL: `#BTN/open` opens that chart directly, and
`#odds` opens the pot odds trainer. The address bar tracks whichever tab you
are on, so a reload comes back where you were.

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
