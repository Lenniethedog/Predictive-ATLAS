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
| `shorts/short-0N.mp4` | YouTube Short per episode: 1080×1920, under 60 s, burned-in captions |
| `shorts/short-0N.txt` | Title, description, photo credits and hashtags for that Short |

## How it works

1. **Narration engine** — `ENGINE` in `src/config.mjs` selects **Chatterbox** (Resemble
   AI, MIT licence, runs locally on the Mac's GPU) or the original **Kokoro**. Chatterbox
   reads with far more human prosody. It is matched to the channel's British narrator from
   a 10-second reference clip (`assets/voice/george-reference.wav`), so the voice keeps its
   identity. `src/voice_worker.py` voices passages of one to three sentences, transcribes
   each take straight back with Whisper, and regenerates any take whose words don't match
   the script (skipped phrases, repeats, garbled names), keeping the best. Sentence
   boundaries come from Whisper's word timings. Expressiveness follows the scene's mood.
   All Chatterbox audio carries Resemble's inaudible PerTh watermark, left intact. Setup:
   `uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python chatterbox-tts
   faster-whisper`, with model files in `.venv/models/` (see Notes). Set
   `NARRATION_ENGINE=kokoro` to use the original engine.

   Delivery policy — each scene in `src/episodes/epN.mjs` carries its spoken
   paragraph, visual cue, and score mood. `src/tts.mjs` uses **Kokoro-82M** locally
   in full precision. The British `bm_george` narrator receives British phonemes;
   American voices receive American phonemes. Proper-name corrections cover both
   accents. Small groups of sentences keep connected thoughts together. Delivery
   slows for quantities, conclusions, and a few deliberate punch lines, while
   explanatory passages keep moving. Pauses respond to connective phrases and
   contrast rather than following one fixed interval. Quiet consonants and natural
   release tails survive trimming. Uncertain sentence boundaries trigger a new
   read of individual sentences; estimated boundaries never drive the animation.
   The output retains the model's own breaths. No synthetic breath noise, pitch
   wobble, fake room reverb, or added room noise is used. A light de-esser, low-cut
   filter, and loudness normalization finish the read at −16 LUFS, 48 kHz stereo.
   Scripts stay around 1,500 words without padding to hit an exact count. Timings,
   captions, and the score rebuild from the revised read. Older audio is backed up
   in `out/archive/narration-v5/` and `out/archive/narration-v6/` for comparison.
2. **Score** — `src/music.mjs` generates an ambient bed per episode from scratch (no
   samples, no licensing): a low tonic drone, detuned pad chords that follow the scene's
   mood (establish, pressure, shock, cold, close, and the rest), a soft bell on scene
   changes, a plucked motif that thins out in cold and shock scenes, a heartbeat under
   pressure, shock, and fracture, faint air, all in a long reverb. A closing scene stays
   unresolved. Each episode has its own key. The score holds through the final shot and
   stops on the cut to black.
3. **Sound design** — `render.mjs --events` walks every scene at 10 Hz and on each sentence
   beat, then searches back for the moment a graphic actually appears. Unchanged scenes are
   not redrawn. Stamps, captions, and line draws carry their own start time. Panels sound
   when they have a title or an `sfx` name. `src/sfx.mjs` pitches those cues from the scene
   mood and turns the list into a quiet effects track:
   whooshes on scene changes, a low thud under stamps, tuned blips for tags, typing ticks,
   a shimmer as lines draw, an ident on the title card and a hit on the final cut.
4. **Mix** — `src/mix.mjs`: narration on top; score set ≈15 dB under the voice and ducked
   while it speaks; effects lower still, lightly ducked; gentle limiter.
5. **Animation** — `src/render.mjs` draws every frame with Skia (`@napi-rs/canvas`) and
   pipes raw frames into ffmpeg. Each episode module (`src/episodes/epN.mjs`) has one
   scene per narration paragraph; each scene is a direct translation of the bracketed
   visual cue that follows that paragraph in `episode-0N-script.txt`, with its beats keyed
   to a phrase in the sentence (`S.at("China finances")`), so inserting a line cannot slide
   the picture off the words. A sentence index throws. The finished MP4 carries the SRT as
   a subtitle track and a chapter marker for each scene.
   Finishing touches: a slow push-in plus a few pixels of organic camera drift, soft
   bloom on bright elements, faint drifting motes, labels that decode into place, a
   typing cursor on captions, a light sweep on scene changes, film grain and a final
   dither so dark gradients don't band (encoded with x264 `aq-mode=3`).
6. **Maps** — Natural Earth geometry via `world-atlas` + `d3-geo`. Routes, pipelines,
   rivers and the Ukraine contact line are approximate hand-placed coordinates in
   `src/engine/geo.mjs` (`P`, `LANES`, `PIPES`, `RIVERS`, `CONTACT_LINE`). Quantities drawn
   on screen (the Malacca split, pipeline design capacities, the pre-break German gas mix,
   and the contact-line date) are read from `src/figures.mjs`.

Style follows the channel brief: charcoal ground, U.S.-aligned nodes cyber-cyan, BRICS /
alternative corridors tactical amber, China crimson, Russia dark red. Mearsheimer, Sachs
and Jiang appear as faceless vector "lens badges" (silhouette + glasses, no likeness)
the first time each is named in a paragraph.

## Commands

```bash
npm install                      # once
node src/build.mjs               # everything, all five; skips stages whose inputs are unchanged
node src/build.mjs 3 --preview   # episode 3 at 960×540, 15 fps, without bloom, grain, or dither
node src/build.mjs 3 --no-tts    # one episode, keeping its narration (after visual edits)
node src/build.mjs 3 --force     # rebuild episode 3 even when stamps say it is current
node src/tts.mjs 3               # narration only (≈3 min; cached per phrase)
node src/render.mjs 3 --events   # animation -> effects cue list (cached per scene)
node src/render.mjs 3 --preview  # 960×540, 15 fps, no bloom/grain/dither -> out/previews/
node src/sfx.mjs 3 && node src/music.mjs 3 && node src/mix.mjs 3   # soundtrack
node src/render.mjs 3            # full video for one episode
node src/render.mjs 3 --sheet    # contact sheets only (seconds)
node src/render.mjs 3 --grid 2.5 # every scene at 2.5 s in, tiled (checks scene openings)
node src/render.mjs 3 --stills 120.5,300   # PNG frames at absolute times
node src/render.mjs 3 --from 60 --to 90    # preview clip -> out/previews/
node src/check.mjs               # narration, cue, mood, and drawing still match
```

`scripts/episode-0N-narration.txt` and `scripts/episode-0N-script.txt` are written from the episode modules (`node src/export-scripts.mjs`, or `python3 ../scripts/build_scripts.py`). Edit the module, not the text files.

### Changing the voice

The default is `bm_george` (British male), at speed `0.96`. Listen to `out/voice-samples/`, then either
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

## Shorts

`node src/shorts.mjs` (or `node src/shorts.mjs 3`) cuts one vertical Short per episode
from the finished film: the episode's opening thesis plus, where it fits, a payoff line
from later in the film (choices in `SHORTS` at the top of the file). Picture and
narration come from the same moments, so sync is exact. The layout keeps clear of the
Shorts interface: headline at the top, the full 16:9 picture in the middle (nothing
cropped), large word-by-word captions with the spoken word lit, and an end card pointing
to the full episode. Word timings come from Whisper (`src/words.py`). The score runs
continuously under the cuts, a whoosh marks each cut, and the mix finishes at −14 LUFS
for phone playback. Each Short gets an upload text with photo credits for any credited
photograph inside its cut. Re-run after re-rendering the films.

## Notes

- Model files (not in git): `.venv/models/chatterbox/` holds `t3_cfg.safetensors`,
  `s3gen.safetensors`, `ve.safetensors`, `tokenizer.json` and `conds.pt` from
  `ResembleAI/chatterbox`; `.venv/models/whisper-small.en/` holds
  `Systran/faster-whisper-small.en`. On a slow line, `aria2c -x 16 -c` resumes reliably.

- The data shown on screen is either from the scripts themselves (the 11 mb/d split,
  800 mn bbl stock, pipeline design capacities, etc.) or explicitly labeled
  `APPROX.` / `ILLUSTRATIVE` (e.g. China's Treasury holdings, price-regime curves,
  the supply cost curve).
- `node src/tts.mjs` may print `libc++abi: ... mutex lock failed` as it exits. That is
  onnxruntime tearing down after all files are written; it is harmless.
- Episode 5's cues stay at the level of categories and priced options, never procedures,
  as the script directs.

### Continuing Episode 1’s visual treatment

Episodes 2–5 use shorter, plain-language screen labels and retain narration around
1,500 words. Four-outcome cards wrap their explanations; hypothetical
backup-capacity bars and payoff curves are labeled illustrative. Scenes that
already contain thinker cards can set `noBadges: true` to avoid duplicate overlays.

Credited photo cutaways live in `src/engine/photos.mjs` and render directly into
full films, previews, and contact sheets. Each photograph settles from a closer
crop, drifts forward, and exits with a gentle tilt, accelerating zoom, and soft
dissolve into the moving scene underneath. Captions remain level and fade before
the exit. Overscan keeps the frame covered throughout the movement.
The photo files participate in build
stamps, so changing a cutaway rebuilds the picture. Subtitles, chapter markers,
and the final silent hold survive soundtrack updates. `src/broll.mjs` remains a
manual tool for older animation-only exports; normal builds include photos already.
The Jefferson Lab cleanroom is shown on the cleanroom-fragility line, with its
location in the caption, rather than presented as a Taiwanese chip factory.

To review the updated episodes: `node src/render.mjs 2 --preview` (repeat for 3–5).
For final exports with updated effects: `node src/build.mjs 2 3 4 5 --no-tts`.

### Voice revision and checks

The current `spoken-v7-conversation` read joins related short statements, uses
more direct spoken wording, and keeps up to four sentences in a connected
passage when the model's token limit allows. Its base speed is 0.96, with shorter
pauses for continuations and a separate pause for questions. Figures and closing
thoughts still receive more time. `node src/review.mjs` writes `out/review.html`
with all five recordings, the previous read, passage seeking, and full-film links.

`src/narration.mjs` holds the delivery policy. Narration timing files record the
voice, accent, speed, policy revision, and a fingerprint of the synthesis code.
Builds check those values before reusing audio. A changed voice treatment therefore
cannot silently reuse an older recording. Adoption also checks the actual title
hold, paragraph gaps, and closing hold against the current timeline policy.
`npm test` checks accent phonemes,
phrase pacing, quiet consonants, photo timing, and every animation anchor against
the authored text. Cue-recording checks verify that skipping pixel rasterization
preserves the same effects events. `npm run check` checks script exports and
episode structure.

`node src/build.mjs --preview` rebuilds all five soundtracks and review films;
`node src/build.mjs` produces the final 1080p films. A new read needs a new picture
render because its sentence timings have changed; do not use `--remux` for it.
A natural-sounding synthetic read does not carry any guarantee about AI detectors.
