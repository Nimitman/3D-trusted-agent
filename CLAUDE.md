# Trusted Agent · Housing.com campaign film

A scroll-controlled 3D film in seven chapters. Approved storyboard: https://claude.ai/artifact/1Z8bJRDKULPCv831yedg8A (source in `storyboard/`).

## Run

```bash
npm run dev     # http://localhost:5317  (?debug for the HUD, ?tier=full|lite|flat to force a tier, ?motion=reduced to preview reduced motion)
# With ?debug, window.__shoot(p) renders an exact still at film progress p (works when the browser has paused frames).
npm run build   # type-check + production build
```

## Architecture

- **One timeline.** `src/story/timeline.ts` maps scroll to film progress `p` (0 → 1). Chapter ranges overlap; scenes derive local time with `localT(p, id)`. Each chapter's beats live in `src/story/chNN.ts`, shared by 3D, captions and 2D.
- **Worlds and cuts.** `activeWorld(p)` picks which 3D world renders. Worlds change only behind a cut: black (01→02), fog (02→03), light (03→04). Chapters 04–07 share one world and one continuous camera; the 2D lockup (`ui/Lockup.tsx`) ends the film.
- **After the film.** `src/proof/` is an ordinary page section ("What makes an agent trusted?") below the film's spacer. Film progress is measured against the spacer only (`filmScrollLength`), and the film stops rendering once the section covers the screen (`beyond >= 1`).
- **Sound.** Off by default. Background music, generated with Web Audio and scheduled on the audio clock: a 72 BPM progression in D minor (pad, pulse, felt piano, high strings) that releases into D major when the keystone seats, plus musical hits at the key transitions. `src/sound/score.ts` holds the arrangement and cues as data; `src/sound/engine.ts` plays it and loads only when the toggle is first pressed. Audio is unlocked synchronously in the click (Safari). `?debug` exposes `window.__sound`.
- **One copy source.** Every line of the film lives in `src/story/copy.ts`. The 3D, the 2D fallback and the screen-reader narrative (`StoryText`) all read it.
- **Per-frame state is never React state.** `p`, `v` (scroll velocity) and `pointer` live in the zustand store and are read with `film()` inside `useFrame`, or written to CSS variables via `useFilm.subscribe`. Only `tier` and `ready` trigger renders.
- **Camera.** `src/three/CameraRig.tsx` has `cameraAt(p)` (add each chapter's segment there) and a damped follow. Never set the camera from scenes.
- **Badge geometry.** `src/three/geometry/keystone.ts` is pure math (no three.js) and is shared by 3D, 2D and future SVG marks. three.js helpers live in `keystone3d.ts`. Keep it that way so the 2D bundle stays small.
- **Tiers.** `full` (reflections, refraction, 900 dust motes), `lite` (matte floor, ~320 motes, lower DPR), `flat` (2D CSS/SVG film, also used for reduced motion). `detectTier` picks the start; `PerformanceMonitor`, the GL error boundary, context loss and a 10 s stall guard can only step down.

## Brand rules (from the approved storyboard)

- Palette: void `#0c0b0a`, charcoal, stone, bone `#ece7de`. Tungsten light only in Chapter 03.
- **Purple appears only at its moments** (rim on solid figures in Ch02, the locks, the keystone, the lockup mark). Never as ambience or decoration. The lockup has no buttons for now (removed after review: they interrupted scrolling on); their copy is kept in copy.ts. `#5e23dc` is a placeholder until Housing.com supplies the brand value.
- Type: Archivo. 3D text uses the static instances in `public/fonts/` (Expanded ExtraBold, Condensed ExtraLight); HTML uses the variable font. Body: Hanken Grotesk. Labels: Geist Mono.
- Badge: Keystone. Build order Verified (plinth) → Responsive (left pier) → Quality (right pier) → Consistent (voussoirs) → Trusted (keystone). Never show it complete before Chapter 05.
- Lines to be read appear in one fixed place, one at a time, at full contrast; check 360px and `?tier=flat` too.
- Accessibility: one `<main>` (story text, spacer, proof section). Visual-only layers (canvas, captions, lockup) are `aria-hidden`; their words live in `StoryText`. Reduced motion gets no scroll-linked zoom anywhere.
- Copy is short, restrained and never salesy. No invented testimonials, scores or metrics. The Chapter 06 stories are placeholders until real consented quotes exist.
- No stock imagery, floating UI cards, glassmorphism or cartoon people. Figures stay faceless.
