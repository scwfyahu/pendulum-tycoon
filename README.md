# pendulum

Double-pendulum tycoon. Beat = `harmony`: every track at its target (360 points).
Verified by simulation: **59:59** optimal, **133 min** for careless builds.

## Run it

**Just double-click `pendulum.html`** — one self-contained file, no server, no
sibling files, works from any folder, any extractor, any device.

Multi-file dev version: `index.html` + `js/` (needs same folder, or a server):

```
python3 -m http.server 8777     # then http://127.0.0.1:8777/
```

## Controls

| input | effect |
| --- | --- |
| **click void** | pulse: kicks every pendulum, +fling boost |
| **click void in a ring** | **resonance**: bob crosses the bottom → 0.22s window → payout ≈ 0.5s of income + overdrive charge |
| **click a tick** (bottom strip) | buy a level · hover = cost + gain · **shift** = buy 50 |
| **drag a bob** | fling it (velocity carries on release) |
| **click a focus zone** (5× per run) | one-time archetype multiplier |
| **m / r** | mute / restart |

## The build decision

Nine tracks, three archetypes — same-ish entry price, very different gains:

```
calm   +2% /level      cheap filler, always relevant
flare  +6% /level      middle path
surge  +16% /level     strong now, self-punishing when stacked
```

Value of a level = `ln(1+gain) / cost`. Cost growth tracks income growth
(`growth = Π(1+r)` over active tracks), so the best purchase **rotates** as
levels rise. Stack the wrong track and you pay for it: simulation shows

- optimal play **59:59**
- "surge feels strong" play **133 min** (×2.22)

Five **keystone choices** (60/120/180/240/300 progress) multiply income by
`1 + 0.015 × levels of that archetype you already own` — double-down or
diversify, the answer depends on the build you brought.

Pacing assumes **zero player skill** (swing 0.93, modelled overdrive, no
resonance hits). Timing and flinging only ever make it faster.

## Layout

| file | role |
| --- | --- |
| `pendulum.html` | self-contained build (generated — ship this) |
| `index.html` | dev shell |
| `js/econ.js` | pure economy: archetypes, growth identity, keystones (browser + node) |
| `js/pendulum.js` | RK4 double pendulum (browser + node) |
| `js/audio.js` | synthesized WebAudio, zero assets |
| `js/render.js` | scene + minimal chrome, canvas only |
| `js/game.js` | state, input, resonance timing, loop |

## Tests

```
node test/sim.js     # good vs noob vs cheap play -> 59:59, choice matters
node test/phys.js    # auto-push sustains swing vigour
node test/build.js   # regenerate pendulum.html
```
