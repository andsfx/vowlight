# VOWLIGHT — build brief

A browser game for make.fun's `best-game-01` bounty. Vanilla ES modules, canvas 2D, no build step,
no network, no external assets. The judge only ever sees 4 screenshots (contact sheet) plus a few
dozen lines of source outline, so the game has to look complete and striking in stills, and its
files and functions have to be named for what they do.

## Pitch

You are the last lantern-keeper of a drowned observatory. The dark sends husks to snuff the flame.
You cannot attack: you carry a curved **ward** that reflects their bolts back at them. Survive ten
waves and the vow is kept.

Title: **VOWLIGHT**. Tagline: "Keep the flame. Return the dark."

## Why this design

- One mechanic with depth: aim the ward (mouse), brace to widen it (space), reflect to kill, chain
  reflections into groups, and protect the flame. No shooting, so every kill is a read and a parry.
- Screenshots read well: a bright amber core, a cyan ward arc, magenta bolts mid-flight, glow,
  particles, a chunky HUD, and four distinct screens (title, play, victory, defeat).
- A real win condition (clear wave 10) and a real loss (flame out), both with restart.

## Field and look

- Fixed logical field 1280x720; renderer scales to the window with letterboxing; all rules use
  logical coordinates only.
- Palette in `config.js`: deep background `#070d12`, floor haze `#0d1720`, amber flame `#ffb347`,
  ward cyan `#57e0d8`, enemy violet `#8b7bf0`, bolt magenta `#ff5d73`, text `#e9f1f2`, muted
  `#7d8c96`, danger `#ff4d6d`.
- Look: near-black arena with a soft radial haze, a faint concentric ring grid marking the ward's
  reach, drifting ash motes, and bloom done by drawing each glow twice (wide translucent pass, then
  a crisp pass). Vignette darkens the corners. No images, everything drawn in code.
- Camera shake on hits and kills (short, small). Hit flash: 90 ms white-amber screen wash.

## Rules (all numbers live in `config.js`)

- Core: radius 14 at the arena centre, speed 300 px/s, kept inside a 44 px margin.
- Aim: the ward centres on the angle from core to mouse; if the mouse never moved, it points at the
  nearest bolt.
- Ward: 90 degree arc, radius 46. While braced (Space held or right mouse held): 150 degree arc,
  radius 54, core speed halved, and a visible brace ring. Ward has no cooldown; bracing is the
  cost (you slow down and the ward's rim glows hotter).
- Bolts: enemy projectiles, radius 5, speed 210-260 px/s, each with an owner and a telegraph.
  A bolt that touches the ward arc is reflected: its direction mirrors across the ward normal, it
  becomes friendly (bright cyan-white), gains 1.35x speed, and lives 3 s.
- Friendly bolts kill the first enemy they touch and burst for splash damage in a 46 px radius.
  Chain: an enemy killed by burst also counts toward combo.
- Enemies:
  - `wisp` — drifts to an orbit ring, fires a slow bolt every 2.2 s. 1 hp, 10 points.
  - `lancer` — holds still, telegraphs a thin beam for 1.0 s, then fires a fast straight bolt. 2 hp,
    25 points.
  - `splitter` — slow chaser; on death splits into two wisps. 3 hp, 40 points.
  - `warden` — elite, appears on waves 4, 7 and 10. Armoured front: a bolt that hits its front plate
    is destroyed; it must be hit from the back or by splash. Fires a 3-bolt spread. 6 hp, 150 points.
- Waves: 10 waves. Wave N spawns 3 + N enemies (capped at 9 alive at once), scheduled over the wave.
  A warden joins on waves 4, 7 and 10. Between waves, a 3 s breather with a "WAVE N" banner.
  Clearing wave 10 wins.
- Flame: 3 pips. An enemy bolt hit costs 1 pip, grants 1.6 s of invulnerability (core flickers), and
  resets the combo. At 0 pips the run ends in defeat.
- Combo: each kill within 3.5 s of the last raises the multiplier by 1 up to x8; it decays to x1
  when the window lapses. Score per kill = points x multiplier.
- Best score persists in localStorage under `vowlight.best`.
- Restart: Space or R on the defeat and victory screens, and on the title screen Space starts.

## Audio (`audio.js`)

WebAudio only, synthesised, created on the first user gesture: a ward ping (short sine sweep up), a
kill pop (noise burst through a bandpass), a hurt thud (low square with a fast decay), a wave gong
(two low sines), a victory chord (three sines, slow attack), and a quiet drone bed while playing.
Every sound has its own named function; nothing loads from disk.

## Screens

- Title: big VOWLIGHT wordmark with a lantern glyph, tagline, control legend (WASD move, mouse aim
  ward, space brace, R restart), "PRESS SPACE" pulsing, best score, and a live attract layer behind
  (ash motes and a slow orbiting husk silhouette).
- Play: full HUD — score top-left with multiplier chip, wave `N / 10` top-right, flame pips
  bottom-left with labels, brace hint bottom-centre, best bottom-right.
- Victory: "THE VOW IS KEPT" panel with score, waves cleared, best combo, time, and "PRESS SPACE TO
  PLAY AGAIN"; the ward ring behind is fully lit amber.
- Defeat: "THE FLAME GOES OUT" panel with score, wave reached, best combo, and the same restart
  prompt; the arena behind is cold and dim.

## Files (one clear job each, named for what it does)

```
game/index.html          page shell, canvas, accessible status line
game/src/main.js         boot, screen flow, fixed-step loop
game/src/config.js       every tuning number, colour and label
game/src/random.js       seeded mulberry32 rng
game/src/input.js        keyboard steer, pointer aim, brace and one-shot keys
game/src/core.js         the keeper: movement, ward arc, brace, flame pips
game/src/swarm.js        enemy roster, wave director, enemy ai
game/src/bolts.js        projectile pool, reflection, friendly bolts and splash
game/src/collision.js    circle and arc hit tests, reflection maths
game/src/effects.js      particles, bursts, shake, screen flash
game/src/audio.js        synthesised sound bank and drone
game/src/hud.js          in-play hud: score, wave, flames, combo, brace hint
game/src/screens.js      title, victory and defeat panels
game/src/render.js       draw order: arena, ward ring, entities, hud, overlays
game/src/shots.js        ?shot=title|play|victory|defeat deterministic scenes
```

Rules for the code:

- ES modules with static relative imports only; no bundles, no vendor library, no fetch, no timers
  that reach the network, no dynamic import of a remote specifier.
- Every file starts with a one-line comment saying its job. Every exported function is named for
  what it does (`reflectBolt`, `spawnWave`, `drawFlamePips`), because the outline the judge reads is
  mostly file paths plus first declarations.
- Fixed step 1/60 s, accumulator loop, no rng outside the seeded one for rules (visual noise may use
  the same rng).
- `?seed=N` fixes the run. `?shot=<scene>&seed=N` stages a scene, paints twice, then sets
  `window.__shotReady = true`. Scene names: `title`, `play`, `victory`, `defeat`.

## Screenshot scenes (deterministic, real renders)

- `title`: 40 simulated steps of attract drift, then draw title screen over the arena.
- `play`: play wave 4 with an autopilot for ~22 s: aim the ward at the nearest incoming bolt, brace
  when a bolt is within 220 px, drift toward the arena centre; stop at a frame with a reflection in
  flight and combo x5 or more on screen; prefer a frame where three or more bolts are visible.
- `victory`: simulate a won run cheaply (clear waves 1-10 with the autopilot, or seed state directly
  with a plausible score, waves 10, best combo 7, time), then draw the victory panel.
- `defeat`: simulate until the flame is out (autopilot that does not brace), then draw the defeat
  panel.

## Acceptance checklist

1. `node serve.ts --port 8097` then open each scene; no console errors, no 404s.
2. Four scenes render distinct, readable frames; title/victory/defeat panels are legible when the
   contact sheet shrinks them to small cells; the play frame shows bolts, the ward arc, enemies, the
   full HUD and a combo chip.
3. Screenshots are 1280x720 JPEGs under 256 KiB (`tools/tojpeg.py`).
4. `node --check` (or module import) passes for every file under `game/src/`.
5. Playing it by hand works: title -> space -> move/aim/brace -> kills -> wave banner -> death ->
   restart. No stuck states.
6. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` twice gives byte-identical `out/`
   (`diff -r out1 out2`) and `dossier.json` is accepted by the counters in `main.ts`.

## Do not

- Do not edit `vendor/makefun-game.ts` (it must stay byte-identical to the kit copy).
- Do not commit generated `out*/` folders.
- Do not add network calls, remote fonts, or assets outside `game/`.
- Do not write anything into `screenshots/` except real renders produced by the pipeline above.
