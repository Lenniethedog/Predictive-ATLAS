# Predictive Atlas — production

Narration and animation for the five episode scripts in `../scripts/`.
Everything runs locally: no API keys, no cloud services.

## Outputs (`out/`)

| Path | What |
|---|---|
| `video/episode-0N.mp4` | Final episode: 1920×1080, 30 fps, H.264 + AAC, ~11 min |
| `audio/episode-0N-narration.wav` / `.mp3` | Narration only, 48 kHz, loudness-normalized to −16 LUFS |
| `subtitles/episode-0N.srt` | Captions timed to the narration (upload alongside the video) |
| `timing/episode-0N.json` | Paragraph + sentence timings the animation is synced to |
| `voice-samples/*.mp3` | Episode 1's opening paragraph in seven alternative voices |
| `sheets/epN/scene-NN.png` | Contact sheets (4 frames per scene) used for visual QA |

## How it works

1. **Narration** — `src/tts.mjs` reads `../scripts/episode-0N-narration.txt`, splits it
   into sentences, and synthesizes each one with **Kokoro-82M** (Apache-2.0, runs on CPU
   via `kokoro-js`). Proper nouns are corrected at the phoneme level (`PHONEME_FIXES`:
   Mearsheimer, Malacca, Daqing, yuan, Kazakhstan, Sevastopol, Yunnan). Pauses: 0.42 s
   between sentences, 1.6 s between paragraphs, a 3 s silent title card up front and a
   4 s hold + 1 s black at the end. Result: ~11 min per episode at ~138 wpm.
2. **Animation** — `src/render.mjs` draws every frame with Skia (`@napi-rs/canvas`) and
   pipes raw frames into ffmpeg. Each episode module (`src/episodes/epN.mjs`) has one
   scene per narration paragraph; each scene is a direct translation of the bracketed
   visual cue that follows that paragraph in `episode-0N-script.txt`, with its beats keyed
   to sentence start times (`S.at(i)`), so visuals land on the words that motivate them.
3. **Maps** — Natural Earth geometry via `world-atlas` + `d3-geo`. Routes, pipelines,
   rivers and the Ukraine contact line are approximate hand-placed coordinates in
   `src/engine/geo.mjs` (`P`, `LANES`, `PIPES`, `RIVERS`, `CONTACT_LINE`).

Style follows the channel brief: charcoal ground, U.S.-aligned nodes cyber-cyan, BRICS /
alternative corridors tactical amber, China crimson, Russia dark red. Mearsheimer, Sachs
and Jiang appear as faceless vector "lens badges" (silhouette + glasses, no likeness)
the first time each is named in a paragraph.

## Commands

```bash
npm install                      # once
node src/tts.mjs                 # narration for all five (≈3 min each; cached per sentence)
node src/tts.mjs 3               # one episode
node src/render.mjs 3            # full video for one episode (≈8 min)
node src/render.mjs 3 --sheet    # contact sheets only (seconds)
node src/render.mjs 3 --stills 120.5,300   # PNG frames at absolute times
node src/render.mjs 3 --from 60 --to 90    # preview clip -> out/previews/
```

### Changing the voice

The default is `am_michael` (American male). Listen to `out/voice-samples/`, then either
edit `VOICE` / `SPEED` in `src/config.mjs`, or pass them on the CLI, and re-render:

```bash
node src/tts.mjs --voice bm_george --speed 0.96 && for n in 1 2 3 4 5; do node src/render.mjs $n; done
```

The animation re-times itself automatically from the new `timing/*.json`.

To use an external voice (e.g. a studio read or ElevenLabs), replace the narration but
keep the timing file: the renderer only needs `out/timing/episode-0N.json` (sentence
start/end times) and `out/audio/episode-0N-narration.wav`.

## Notes

- The data shown on screen is either from the scripts themselves (the 11 mb/d split,
  800 mn bbl stock, pipeline design capacities, etc.) or explicitly labeled
  `APPROX.` / `ILLUSTRATIVE` (e.g. China's Treasury holdings, price-regime curves,
  the supply cost curve).
- `node src/tts.mjs` may print `libc++abi: ... mutex lock failed` as it exits. That is
  onnxruntime tearing down after all files are written; it is harmless.
- Episode 5's cues stay at the level of categories and priced options, never procedures,
  as the script directs.
