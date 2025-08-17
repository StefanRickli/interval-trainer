# Interval Trainer (Web)

Practice imagining and singing random intervals in your browser.  
Card UI shows **Previous note**, **Interval prompt** (e.g., `m3 ↑`), and a **Target note** that stays blurred until revealed. Uses Tone.js (Synth or Sampler). Settings persist in `localStorage`.

## Demo
Host with GitHub Pages (instructions below).

## Features
- Card-like layout: **Previous note** (playable), **Interval**, **Target note** (blurred until reveal)
- Controls: **Reveal & Play**, **Play Previous**, **Next card**
- Keyboard shortcuts: **Space** = reveal/replay, **P** = play previous, **N** = next
- Configurable **interval pool** and **note range** (default **E2–C6**)
- Enharmonic names like **C#/Db**; optional octave numbers
- Engines: **WebSynth** (basic), **Tone Synth**, **Tone Sampler** (piano)
- Range-safe card generator (re-draws until target fits range)
- Settings saved in the browser

## File Structure
- index.html # layout + Settings dialog
- style.css # styles
- app.js # UI logic, state, shortcuts, settings, generator
- synth.js # audio engines: WebSynth, ToneSynthEngine, ToneSamplerEngine
- favicon.png # optional (link in <head>)

## Quick Start (local)
1. Clone or download this repo.
2. Open `index.html` in a modern browser.
3. Click a control once to allow audio (browser autoplay policy).
4. Use **Settings** (⚙️) to adjust range, interval pool, engine, and display.

## Keyboard Shortcuts
- **Space** — Reveal target & play (then replay)
- **P** — Play previous note
- **N** — Next card

## Tech Notes
- **Autoplay policy**: Audio starts after the first user gesture (click/keydown).  
- **Sampler**: First note waits for sample load the first time you use Tone Sampler.  
- **Persistence**: Settings stored under `interval-trainer-settings-v1` in `localStorage`.  
- **Enharmonics**: Sharps display as `C#/Db`. Toggle octave numbers in Settings.

## Credits
- [Tone.js](https://tonejs.github.io/) for synthesis & sampling.
- Salamander Piano samples (via Tone.js demo CDN).

## License
MIT — see `LICENSE`.
