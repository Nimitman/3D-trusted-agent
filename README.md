# Trusted Agent · Housing.com

A scroll-controlled 3D film in seven chapters for Housing.com's Trusted Agent campaign. Scrolling drives one continuous camera from a single point of light, through a crowd, a tower at night and four small moments, to a badge that is built piece by piece and finally named.

High-fidelity prototype. Built with Vite, React, React Three Fiber, drei, postprocessing, Lenis and zustand.

## Run

```bash
npm install
npm run dev     # http://localhost:5317
npm run build   # type-check and production build
```

Useful query parameters:

- `?tier=full|lite|flat` forces a quality tier (`flat` is the 2D film, also used for reduced motion)
- `?debug` shows a progress HUD and enables `window.__shoot(p)` for exact stills at film progress `p`

## Structure

- `src/story/` the timeline, every line of copy, and each chapter's beats
- `src/three/` the 3D stage, camera rig and chapter worlds
- `src/flat/` the 2D version of the film
- `src/ui/` captions, chrome and the final lockup
- `storyboard/` the approved Phase 1 storyboard

`CLAUDE.md` has the architecture notes and brand rules.

## Before launch

- Replace the Chapter 06 stories with real, consented customer quotes (they are marked as sample copy on screen).
- Swap `--purple` (`#5e23dc`) for the Housing.com brand value and add the wordmark files.
- Point the two lockup buttons at the directory and the trust explainer.

Archivo is licensed under the SIL Open Font License (`public/fonts/OFL.txt`).
