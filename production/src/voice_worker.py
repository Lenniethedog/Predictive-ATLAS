"""Narration worker: Chatterbox (MIT, local) voices a passage; Whisper (local) checks it.

Started by src/tts.mjs when ENGINE is "chatterbox". Reads one JSON request per line on
stdin and answers one JSON line on stdout:

  request  {"id", "text", "out", "exaggeration", "cfg", "temperature", "seed", "tries"}
  reply    {"id", "out", "sr", "dur", "wer", "tries", "words": [{"w", "start", "end"}]}

Each take is transcribed straight back. If the words don't match the script (a skipped
phrase, a repeat, a garbled name) it is regenerated with a new seed, and the best take is
kept. Word times come from the transcript, aligned to the script's own words, so the
caller can place sentence boundaries exactly. Takes are trimmed to the speech plus its
natural release, never to a fixed length.

All Chatterbox audio carries Resemble AI's inaudible PerTh watermark; it is left intact.
"""
import difflib
import json
import os
import re
import sys

import numpy as np
import torch
import torchaudio as ta

ROOT = os.path.join(os.path.dirname(__file__), "..")
MODELS = os.path.join(ROOT, ".venv", "models")
REF = os.environ.get("VOICE_REF", os.path.join(ROOT, "assets", "voice", "george-reference.wav"))


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"}


def tokens(text):
    out = []
    for w in text.split():
        n = norm(w)
        if not n:
            continue
        out.append(NUM.get(n, n))
    return out


def wer(ref, hyp):
    r, h = ref, hyp
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


def align(script_words, heard):
    """Times for each script word, from Whisper words; gaps interpolated."""
    a = [norm(w) for w in script_words]
    b = [norm(w.word) for w in heard]
    times = [None] * len(script_words)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = [heard[j1 + k].start, heard[j1 + k].end]
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i]:
            continue
        lo = max([k for k in known if k < i], default=None)
        hi = min([k for k in known if k > i], default=None)
        t0 = times[lo][1] if lo is not None else 0.0
        t1 = times[hi][0] if hi is not None else t0 + 0.35
        n_between = (hi if hi is not None else len(times)) - (lo if lo is not None else -1) - 1
        pos = i - (lo if lo is not None else -1)
        step = (t1 - t0) / max(1, n_between)
        times[i] = [t0 + step * (pos - 1), t0 + step * pos]
    return times, len(known), set(known)


def trim(wav, sr, first, last):
    """Speech from just before the first word to the end of its natural release."""
    a = max(0, int((first - 0.07) * sr))
    b = int(last * sr)
    win = int(0.01 * sr)
    limit = min(len(wav), b + int(0.45 * sr))
    while b + win < limit and np.sqrt(np.mean(wav[b : b + win] ** 2)) > 0.004:
        b += win
    b = min(len(wav), b + int(0.06 * sr))
    out = wav[a:b].copy()
    f = min(int(0.012 * sr), len(out) // 2)
    if f:
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        out[:f] *= ramp
        out[-f:] *= ramp[::-1]
    return out, a / sr


def longest_gap(times):
    return max([times[i + 1][0] - times[i][1] for i in range(len(times) - 1)] or [0])


def main():
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    _load = torch.load

    def patched(*a, **k):
        k.setdefault("map_location", torch.device(dev))
        return _load(*a, **k)

    torch.load = patched
    from pathlib import Path

    from chatterbox.tts import ChatterboxTTS
    from faster_whisper import WhisperModel

    model = ChatterboxTTS.from_local(Path(MODELS) / "chatterbox", dev)
    asr = WhisperModel(os.path.join(MODELS, "whisper-small.en"), device="cpu", compute_type="int8")
    model.prepare_conditionals(REF, exaggeration=0.5)
    log(f"voice worker ready on {dev}, reference {os.path.basename(REF)}")
    print(json.dumps({"ready": True, "sr": model.sr}), flush=True)

    for line in sys.stdin:
        if not line.strip():
            continue
        req = json.loads(line)
        text = req["text"]
        want = tokens(text)
        script_words = text.split()
        best = None
        for k in range(int(req.get("tries", 4))):
            torch.manual_seed(int(req.get("seed", 0)) + 1009 * k)
            with torch.no_grad():
                wav = model.generate(
                    text,
                    exaggeration=float(req.get("exaggeration", 0.5)),
                    cfg_weight=float(req.get("cfg", 0.5)),
                    temperature=float(req.get("temperature", 0.8)),
                ).squeeze(0).cpu().numpy().astype(np.float32)
            sr = model.sr
            segs, _ = asr.transcribe(wav if sr == 16000 else ta.functional.resample(torch.from_numpy(wav), sr, 16000).numpy(),
                                     language="en", beam_size=5, word_timestamps=True, vad_filter=False,
                                     condition_on_previous_text=False)
            heard = [w for s in segs for w in (s.words or [])]
            if not heard:
                score = 9.0
                cand = None
            else:
                e = wer(want, tokens(" ".join(w.word for w in heard)))
                times, matched, hit = align(script_words, heard)
                dur = len(wav) / sr
                per_word = dur / max(1, len(script_words))
                gap = longest_gap(times)
                # transcript fidelity first; then plausible pace and no dead air mid-passage
                score = e * 10 + (0.5 if per_word > 0.62 or per_word < 0.2 else 0) + (0.8 if gap > 1.1 else 0)
                cand = (wav, times, e, matched, hit)
            if best is None or score < best[0]:
                best = (score, cand, k + 1)
            if cand and cand[2] <= 0.02 and score < 0.5:
                break
        _, cand, tried = best
        if cand is None:
            print(json.dumps({"id": req["id"], "error": "no speech recognised in any take"}), flush=True)
            continue
        wav, times, e, matched, hit = cand
        clip, offset = trim(wav, model.sr, times[0][0], times[-1][1])
        out_words = [{"w": w, "start": round(t[0] - offset, 3), "end": round(t[1] - offset, 3), "m": int(i in hit)} for i, (w, t) in enumerate(zip(script_words, times))]
        ta.save(req["out"], torch.from_numpy(clip).unsqueeze(0), model.sr)
        print(json.dumps({"id": req["id"], "out": req["out"], "sr": model.sr, "dur": round(len(clip) / model.sr, 3),
                          "wer": round(e, 4), "matched": matched, "total": len(script_words), "tries": tried, "words": out_words}),
              flush=True)


if __name__ == "__main__":
    main()
