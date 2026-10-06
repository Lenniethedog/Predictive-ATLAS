// Ambient score: generated locally (no samples, no licensing), one chord per scene.
//
// A low tonic drone holds underneath; detuned, slowly filtered pad chords move at each
// scene boundary through a minor progression that ends unresolved (sus2, no "lift");
// a soft bell marks each scene change; a sparse plucked motif drifts over the top;
// a low heartbeat pulse sits under the tensest scenes; faint air; all in a Freeverb.
// The score holds through the final hold and stops on the cut to black.
//
//   node src/music.mjs            all episodes
//   node src/music.mjs 2 4        selected episodes
//
// Writes out/audio/episode-0N-music.wav. The final mix is src/mix.mjs.
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./config.mjs";
import { SR, TAU, midiHz, rng, smoothstep, blep, svf, freeverb, writeStereo, sceneClock } from "./engine/audio.mjs";

// Scenes (0-based) that carry a low heartbeat pulse under the pads.
const TENSION = { 1: [5, 9, 12], 2: [0, 6, 8], 3: [2, 9, 10], 4: [1, 7], 5: [0, 6, 11] };

// Tonic (MIDI) per episode — each episode gets its own key colour.
const TONIC = { 1: 38, 2: 36, 3: 40, 4: 41, 5: 39 }; // D, C, E, F, Eb (2nd octave)

// Chord voicings, semitones from the tonic (pad register adds an octave).
const CH = {
  i: [0, 7, 12, 15],
  VI: [-4, 3, 8, 12],
  III: [3, 10, 15, 19],
  VII: [-2, 5, 10, 14],
  iv: [5, 12, 17, 20],
  v: [7, 14, 19, 22],
  sus: [0, 7, 14, 19],
};
const PROGRESSION = ["i", "VI", "III", "VII", "i", "iv", "VI", "v", "i", "VI", "iv", "VII"];

function generate(n) {
  const timing = JSON.parse(fs.readFileSync(path.join(OUT, "timing", `episode-0${n}.json`), "utf8"));
  const total = timing.total;
  const len = Math.ceil(total * SR);
  const { starts, end } = sceneClock(timing);
  const tonic = TONIC[n] ?? 38;
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const sendL = new Float32Array(len);
  const sendR = new Float32Array(len);
  const r = rng(1000 + n);

  // master envelope: swell in over the title card, hold, stop on the cut to black
  const master = (t) => smoothstep(t / 3.2) * (1 - smoothstep((t - (end - 0.12)) / 0.14));

  // ---- 1. tonic pedal drone
  {
    const parts = [[tonic, 0.5, 0], [tonic + 12, 0.22, 0.3], [tonic + 7, 0.12, 0.6]];
    const ph = parts.map(() => 0);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const lfo = 0.85 + 0.15 * Math.sin((TAU * t) / 17);
      let v = 0;
      parts.forEach(([m, a, pp], k) => {
        ph[k] += midiHz(m) / SR;
        v += a * Math.sin(TAU * ph[k] + pp + 0.002 * Math.sin(TAU * t * 0.3));
      });
      v *= 0.15 * lfo * master(t);
      L[i] += v;
      R[i] += v;
    }
  }

  // ---- 2. pad chords, one per scene, crossfaded across boundaries
  {
    const padL = new Float32Array(len);
    const padR = new Float32Array(len);
    const xf = 3.5;
    const sceneCount = starts.length;
    for (let s = 0; s < sceneCount; s++) {
      const name = s === sceneCount - 1 ? "sus" : PROGRESSION[s % PROGRESSION.length];
      const notes = CH[name].map((o) => tonic + 12 + o);
      const t0 = s === 0 ? 0 : starts[s] - xf / 2;
      const t1 = s === sceneCount - 1 ? total : starts[s + 1] + xf / 2;
      const i0 = Math.max(0, Math.floor(t0 * SR));
      const i1 = Math.min(len, Math.ceil(t1 * SR));
      notes.forEach((m, k) => {
        const f = midiHz(m);
        const det = [Math.pow(2, -6 / 1200), Math.pow(2, 7 / 1200)];
        const ph = [r(), r()];
        const amp = k === 0 ? 0.32 : 0.24;
        for (let i = i0; i < i1; i++) {
          const t = i / SR;
          const env = s === 0 ? smoothstep((t1 - t) / xf) : smoothstep((t - t0) / xf) * (s === sceneCount - 1 ? 1 : smoothstep((t1 - t) / xf));
          if (env <= 0) continue;
          for (let d = 0; d < 2; d++) {
            const dt = (f * det[d] * (1 + 0.0015 * Math.sin(TAU * t * (0.11 + d * 0.07)))) / SR;
            ph[d] += dt;
            if (ph[d] >= 1) ph[d] -= 1;
            const saw = 2 * ph[d] - 1 - blep(ph[d], dt);
            if (d === 0) padL[i] += saw * amp * env;
            else padR[i] += saw * amp * env;
          }
        }
      });
    }
    // slowly breathing lowpass, opening a little after each scene change
    const cutoff = (t) => {
      let swell = 0;
      for (const st of starts) if (t >= st && t < st + 8) swell = Math.max(swell, Math.exp(-(t - st) / 2.5));
      return 620 + 420 * (0.5 + 0.5 * Math.sin((TAU * t) / 29)) + 450 * swell;
    };
    svf(padL, cutoff, 0.8);
    svf(padR, (t) => cutoff(t) * 1.04, 0.8);
    for (let i = 0; i < len; i++) {
      const m = master(i / SR) * 0.32;
      L[i] += padL[i] * m;
      R[i] += padR[i] * m;
      sendL[i] += padL[i] * m * 0.9;
      sendR[i] += padR[i] * m * 0.9;
    }
  }

  // ---- 3. air: faint band-passed noise, drifting
  {
    const nL = new Float32Array(len);
    const nR = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      nL[i] = r() * 2 - 1;
      nR[i] = r() * 2 - 1;
    }
    svf(nL, (t) => 2200 + 900 * Math.sin((TAU * t) / 41), 1.4, "band");
    svf(nR, (t) => 2500 + 900 * Math.sin((TAU * t) / 37), 1.4, "band");
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const a = 0.012 * (0.5 + 0.5 * Math.sin((TAU * t) / 13)) * master(t);
      L[i] += nL[i] * a;
      R[i] += nR[i] * a;
      sendL[i] += nL[i] * a * 2;
      sendR[i] += nR[i] * a * 2;
    }
  }

  // ---- 4. bells: one soft tone at each scene change, a few sparse ones between
  {
    const events = starts.slice(1).map((t, s) => ({ t: t + 0.15, s: s + 1, a: 0.07 }));
    for (let t = 9; t < end - 6; t += 9 + r() * 10) {
      if (starts.some((s0) => Math.abs(s0 - t) < 4)) continue;
      events.push({ t, s: starts.filter((s0) => s0 <= t).length - 1, a: 0.035 });
    }
    for (const ev of events) {
      const name = ev.s === starts.length - 1 ? "sus" : PROGRESSION[ev.s % PROGRESSION.length];
      const tones = CH[name];
      const m = tonic + 24 + tones[Math.floor(r() * tones.length)];
      const f = midiHz(m);
      const pan = 0.25 + r() * 0.5;
      const i0 = Math.floor(ev.t * SR);
      const n2 = Math.min(len - i0, Math.floor(6 * SR));
      for (let j = 0; j < n2; j++) {
        const tt = j / SR;
        const env = Math.min(1, tt / 0.006) * Math.exp(-tt / 1.9);
        const v = (Math.sin(TAU * f * tt) + 0.28 * Math.sin(TAU * f * 2.76 * tt) * Math.exp(-tt / 0.6) + 0.08 * Math.sin(TAU * f * 5.4 * tt) * Math.exp(-tt / 0.25)) * env * ev.a * master(ev.t);
        L[i0 + j] += v * (1 - pan) * 0.6;
        R[i0 + j] += v * pan * 0.6;
        sendL[i0 + j] += v * (1 - pan) * 1.4;
        sendR[i0 + j] += v * pan * 1.4;
      }
    }
  }

  // ---- 5. plucked motif: sparse chord tones high up, a two-note figure now and then
  {
    const notesAt = (t) => {
      const sIdx = Math.max(0, starts.filter((s0) => s0 <= t).length - 1);
      const name = sIdx === starts.length - 1 ? "sus" : PROGRESSION[sIdx % PROGRESSION.length];
      return CH[name];
    };
    const pluck = (t, m, a, pan) => {
      const f = midiHz(m);
      const i0 = Math.floor(t * SR);
      const n2 = Math.min(len - i0, Math.floor(3.2 * SR));
      const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
      const gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
      for (let j = 0; j < n2; j++) {
        const tt = j / SR;
        const env = Math.min(1, tt / 0.004) * Math.exp(-tt / 0.9);
        const v = (Math.sin(TAU * f * tt) + 0.22 * Math.sin(TAU * 2 * f * tt) * Math.exp(-tt / 0.25) + 0.06 * Math.sin(TAU * 3.01 * f * tt) * Math.exp(-tt / 0.12)) * env * a * master(t);
        L[i0 + j] += v * gl * 0.5;
        R[i0 + j] += v * gr * 0.5;
        sendL[i0 + j] += v * gl * 1.6;
        sendR[i0 + j] += v * gr * 1.6;
      }
    };
    for (let t = 5 + r() * 3; t < end - 5; t += 2.6 + r() * 3.4) {
      if (starts.some((s0) => Math.abs(s0 - t) < 2.2)) continue;
      if (r() < 0.25) continue; // leave some gaps
      const tones = notesAt(t);
      const k = Math.floor(r() * tones.length);
      const m = tonic + 24 + tones[k];
      const pan = (r() - 0.5) * 0.8;
      pluck(t, m, 0.05, pan);
      if (r() < 0.35) pluck(t + 0.32 + r() * 0.12, tonic + 24 + tones[(k + 1) % tones.length], 0.035, -pan * 0.6);
    }
  }

  // ---- 6. heartbeat pulse under the tensest scenes (lub-dub at ~52 bpm)
  {
    const tense = TENSION[n] ?? [];
    const beat = 60 / 52;
    for (const sIdx of tense) {
      const s0 = starts[sIdx];
      const s1 = sIdx + 1 < starts.length ? starts[sIdx + 1] : end;
      for (let t = s0 + 1.5; t < s1 - 1; t += beat) {
        const env = smoothstep((t - s0 - 1.5) / 5) * smoothstep((s1 - 1 - t) / 3);
        for (const [dt, a] of [[0, 1], [0.27, 0.55]]) {
          const i0 = Math.floor((t + dt) * SR);
          const n2 = Math.min(len - i0, Math.floor(0.45 * SR));
          let ph = 0;
          for (let j = 0; j < n2; j++) {
            const tt = j / SR;
            const f = 46 + 34 * Math.exp(-tt / 0.03);
            ph += f / SR;
            const v = (Math.sin(TAU * ph) + 0.35 * Math.sin(TAU * 2 * ph)) * Math.min(1, tt / 0.003) * Math.exp(-tt / 0.11) * a * env * 0.42 * master(t);
            L[i0 + j] += v;
            R[i0 + j] += v;
          }
        }
      }
    }
  }

  // ---- reverb + gentle saturation
  const [wL, wR] = freeverb(sendL, sendR, { room: 0.88, damp: 0.4, wet: 1 });
  let peak = 0;
  for (let i = 0; i < len; i++) {
    L[i] = Math.tanh((L[i] + wL[i] * 0.55) * 1.2);
    R[i] = Math.tanh((R[i] + wR[i] * 0.55) * 1.2);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = 0.7 / (peak || 1);
  for (let i = 0; i < len; i++) {
    L[i] *= g;
    R[i] *= g;
  }
  return { L, R };
}

const eps = process.argv.slice(2).filter((a) => /^[1-5]$/.test(a)).map(Number);
for (const n of eps.length ? eps : [1, 2, 3, 4, 5]) {
  const t0 = Date.now();
  const { L, R } = generate(n);
  writeStereo(path.join(OUT, "audio", `episode-0${n}-music.wav`), L, R);
  console.log(`ep${n}: music ${(L.length / SR / 60).toFixed(2)} min, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
