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
- `?motion=reduced` previews the reduced-motion film without changing your system setting
- `?debug` shows a progress HUD and enables `window.__shoot(p)` for exact stills at film progress `p`

## Structure

- `src/story/` the timeline, every line of copy, and each chapter's beats
- `src/three/` the 3D stage, camera rig and chapter worlds
- `src/flat/` the 2D version of the film
- `src/ui/` captions, chrome and the final lockup
- `src/sound/` the optional background music: the score as data, and the engine
- `src/proof/` the "What makes an agent trusted?" section after the film
- `scripts/share-assets.py` regenerates the favicon and link-preview image from the badge geometry
- `storyboard/` the approved Phase 1 storyboard

`CLAUDE.md` has the architecture notes and brand rules.

## Before launch

Placeholders that need real inputs:

- **Customer stories (Chapter 06).** Replace the five sample lines in `src/story/copy.ts` with real, consented quotes, then remove the on-screen "Sample stories" tag.
- **Brand purple.** Swap `--purple` (`#5e23dc`) in `src/styles/tokens.css` and the matching values in the 3D scenes and `scripts/share-assets.py`, then re-run `python3 scripts/share-assets.py`.
- **Wordmark.** "Housing.com" is set in text; add the real logo files.
- **"What makes an agent trusted?" wording.** Marked as a draft on screen; the product team must confirm the five dimensions and how they're described.
- **Lockup buttons.** Removed for now; their copy is kept in `copy.ts`. If they return, they need to sit outside the scroll path so they don't block scrolling.
- **Music.** Generated live; a composed or licensed score can replace it using the same cues in `src/sound/score.ts`.
- **Share URL.** The link-preview tags in `index.html` point at the GitHub Pages address; update them if the site moves.

Archivo is licensed under the SIL Open Font License (`public/fonts/OFL.txt`).
