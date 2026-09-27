# pendulum

Double-pendulum tycoon. Beat = `harmony` at 360 levels. Simulated finish: **59:58**.

## Run

```
python3 -m http.server 8777
# http://127.0.0.1:8777/index.html
```

## Play

- **drag a bob** — fling the pendulum, swing vigour raises income
- **click the void** — pulse, kicks every pendulum
- **click a tick** (bottom strip) — buy a level; hover shows name + cost; shift-click buys 50
- **r** — restart

Tutorial: 6 one-line steps on load (`watch` → `pulse` → `buy` → `hover` → `drag` → `shift-click`), each advances on action or auto-timeouts. Runs once per page load. First level is affordable at start (25 ∿ seed).

Nine tracks: `DAMP MASS HARV PUSH CHORD AURA FUSE PHASE HARM`. CHORD adds pendulums, FUSE/PHASE feed overdrive. 12 visual phases, one every 30 levels.

## Layout

| file | role |
| --- | --- |
| `js/econ.js` | pure economy (browser + node) |
| `js/pendulum.js` | RK4 double pendulum (browser + node) |
| `js/render.js` | scene + minimal chrome, canvas only |
| `js/game.js` | state, input, loop |

## Tests

```
node test/sim.js    # autonomous run -> must land 3480-3780s (~1h)
node test/phys.js   # auto-push sustains swing vigour -> income holds
```
