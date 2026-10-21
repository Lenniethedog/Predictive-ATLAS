"""Word timings for a narration clip, aligned to the script's own spelling.

    .venv/bin/python src/words.py clip.wav script.txt out.json

Whisper (faster-whisper, local) supplies when each word is spoken; the script supplies
what the word is. The two token streams are aligned so captions keep the script's
spelling and punctuation, and words Whisper missed are interpolated between neighbours.
"""
import difflib
import json
import os
import re
import sys

from faster_whisper import WhisperModel


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def main(wav, script_path, out_path):
    script = open(script_path, encoding="utf8").read().split()
    local = os.path.join(os.path.dirname(__file__), "..", ".venv", "models", "whisper-small.en")
    model = WhisperModel(local if os.path.exists(os.path.join(local, "model.bin")) else "small.en", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(wav, language="en", beam_size=5, word_timestamps=True, vad_filter=False)
    heard = [w for s in segs for w in (s.words or [])]
    a = [norm(w) for w in script]
    b = [norm(w.word) for w in heard]
    times = [None] * len(script)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k].start, heard[j1 + k].end)
    # interpolate anything Whisper merged, split or missed
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i]:
            continue
        lo = max([k for k in known if k < i], default=None)
        hi = min([k for k in known if k > i], default=None)
        t0 = times[lo][1] if lo is not None else 0.0
        t1 = times[hi][0] if hi is not None else t0 + 0.4
        span = (hi if hi is not None else i + 1) - (lo if lo is not None else i - 1) - 1
        pos = i - (lo if lo is not None else i - 1)
        step = (t1 - t0) / max(1, span + 1)
        times[i] = (t0 + step * (pos - 0.5), t0 + step * (pos + 0.5))
    matched = len(known)
    json.dump(
        {"words": [{"w": w, "start": round(t[0], 3), "end": round(t[1], 3)} for w, t in zip(script, times)],
         "matched": matched, "total": len(script)},
        open(out_path, "w"),
        indent=1,
    )
    print(f"{out_path}: {matched}/{len(script)} words timed by Whisper")


if __name__ == "__main__":
    main(*sys.argv[1:4])
