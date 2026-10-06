# Predictive Atlas — production

Narration and animation for the five episode scripts in `../scripts/`.
Everything runs locally: no API keys, no cloud services.

## Outputs (`out/`)

| Path | What |
|---|---|
| `video/episode-0N.mp4` | Final episode: 1920×1080, 30 fps, H.264 + AAC, ~11 min |
| `audio/episode-0N-mix.wav` / `.mp3` | Final soundtrack: narration + ambient score, −15.5 LUFS |
| `audio/episode-0N-narration.wav` / `.mp3` | Narration only, 48 kHz stereo, −16 LUFS |
| `audio/episode-0N-music.wav` | Ambient score only (full level, before ducking) |
| `audio/episode-0N-sfx.wav` | Sound-design effects only |
| `sfx/episode-0N.json` | Effects cue list recorded from the animation |
| `subtitles/episode-0N.srt` | Captions timed to the narration (upload alongside the video) |
| `timing/episode-0N.json` | Paragraph + sentence timings the animation is synced to |
| `voice-samples/*.mp3` | Episode 1's opening paragraph in seven alternative voices |
| `sheets/epN/scene-NN.png` | Contact sheets (4 frames per scene) used for visual QA |

## How it works

1. **Narration** — `src/tts.mjs` reads `../scripts/episode-0N-narration.txt` and
   synthesizes it with **Kokoro-82M** (Apache-2.0, runs on CPU via `kokoro-js`). To sound
   read rather than listed, sentences are voiced two or three at a time so intonation
   carries across the break; short punch lines ("It breaks.") are isolated, given a beat
   of air either side, and delivered slightly slower. Sentence timings are recovered from
   the silences in each chunk. Pauses vary (≈0.4–0.8 s between sentences, ≈1.3–2 s
   between paragraphs). Proper nouns are corrected at the phoneme level
   (`PHONEME_FIXES`). The voice chain adds a little chest, softens sibilance, compresses
   gently and places the read in a small dry room. Soft synthesized breaths sit before
   each paragraph and some longer phrases, tempo drifts ±1.5% phrase to phrase, and a
   faint room-tone floor keeps pauses from dropping to digital silence.
   ~11 min per episode at ~138 wpm.
2. **Score** — `src/music.mjs` generates an ambient bed per episode from scratch (no
   samples, no licensing): a low tonic drone, detuned pad chords that change at each
   scene boundary through a minor progression (ending unresolved), a soft bell on scene
   changes, a sparse plucked motif, a low heartbeat pulse under the tensest scenes, faint
   air, all in a long reverb. Each episode has its own key. The score holds through the
   final shot and stops on the cut to black.
3. **Sound design** — `render.mjs --events` walks every scene and records what it puts on
   screen (stamps landing, captions typing, tags and panels appearing, lines drawing on,
   scene changes, lens badges). `src/sfx.mjs` turns that list into a quiet effects track:
   whooshes on scene changes, a low thud under stamps, tuned blips for tags, typing ticks,
   a shimmer as lines draw, an ident on the title card and a hit on the final cut.
4. **Mix** — `src/mix.mjs`: narration on top; score set ≈15 dB under the voice and ducked
   while it speaks; effects lower still, lightly ducked; gentle limiter.
5. **Animation** — `src/render.mjs` draws every frame with Skia (`@napi-rs/canvas`) and
   pipes raw frames into ffmpeg. Each episode module (`src/episodes/epN.mjs`) has one
   scene per narration paragraph; each scene is a direct translation of the bracketed
   visual cue that follows that paragraph in `episode-0N-script.txt`, with its beats keyed
   to sentence start times (`S.at(i)`), so visuals land on the words that motivate them.
   Finishing touches: a slow push-in plus a few pixels of organic camera drift, soft
   bloom on bright elements, faint drifting motes, labels that decode into place, a
   typing cursor on captions, a light sweep on scene changes, film grain and a final
   dither so dark gradients don't band (encoded with x264 `aq-mode=3`).
6. **Maps** — Natural Earth geometry via `world-atlas` + `d3-geo`. Routes, pipelines,
   rivers and the Ukraine contact line are approximate hand-placed coordinates in
   `src/engine/geo.mjs` (`P`, `LANES`, `PIPES`, `RIVERS`, `CONTACT_LINE`).

Style follows the channel brief: charcoal ground, U.S.-aligned nodes cyber-cyan, BRICS /
alternative corridors tactical amber, China crimson, Russia dark red. Mearsheimer, Sachs
and Jiang appear as faceless vector "lens badges" (silhouette + glasses, no likeness)
the first time each is named in a paragraph.

## Commands

```bash
npm install                      # once
node src/build.mjs               # everything, all five, in order (≈1 h)
node src/build.mjs 3 --no-tts    # one episode, keeping its narration (after visual edits)
node src/tts.mjs 3               # narration only (≈3 min; cached per phrase)
node src/render.mjs 3 --events   # animation -> effects cue list
node src/sfx.mjs 3 && node src/music.mjs 3 && node src/mix.mjs 3   # soundtrack
node src/render.mjs 3            # full video for one episode (≈8 min)
node src/render.mjs 3 --sheet    # contact sheets only (seconds)
node src/render.mjs 3 --grid 2.5 # every scene at 2.5 s in, tiled (checks scene openings)
node src/render.mjs 3 --stills 120.5,300   # PNG frames at absolute times
node src/render.mjs 3 --from 60 --to 90    # preview clip -> out/previews/
```

### Changing the voice

The default is `am_michael` (American male). Listen to `out/voice-samples/`, then either
edit `VOICE` / `SPEED` in `src/config.mjs`, or pass them on the CLI, and re-render:

```bash
node src/tts.mjs --voice bm_george --speed 0.96 && node src/build.mjs --no-tts
```

The animation and the score re-time themselves automatically from the new `timing/*.json`.
Levels live in `src/mix.mjs`: `MUSIC_LUFS` (−28.5 by default; raise toward −25 for more
presence, lower toward −32 for less) and `SFX_DB` (effects trim, 0 by default). After
changing them, `node src/mix.mjs && for n in 1 2 3 4 5; do node src/render.mjs $n; done`.

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
