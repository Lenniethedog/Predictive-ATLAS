// Recreate chapters with an explicit millisecond clock. Copying MP4 chapter
// clocks while replacing audio can collapse them to zero-length entries.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

export function normalizeVideoClock(video, output) {
  // MP4's chapter clock is derived from all track clocks. A copied 15360 Hz
  // video clock plus captions and 48 kHz audio can overflow long chapter spans.
  // 120000 ticks preserves exact 15/30 fps timestamps and avoids that overflow.
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", video,
    "-map", "0:v:0", "-map", "0:a?", "-map", "0:s?", "-map_chapters", "-1",
    "-c", "copy", "-video_track_timescale", "120000", output], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`cannot normalize video clock: ${video}`);
  return output;
}

export function writeVideoChapters(video, output) {
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_chapters", "-of", "json", video], { encoding: "utf8" });
  if (probe.status !== 0) throw new Error(`cannot read chapters from ${video}: ${probe.stderr}`);
  const chapters = JSON.parse(probe.stdout).chapters ?? [];
  const lines = [";FFMETADATA1"];
  for (const c of chapters) {
    const start = Math.round(Number(c.start_time) * 1000);
    const end = Math.round(Number(c.end_time) * 1000);
    const title = String(c.tags?.title ?? "").replace(/\\/g, "\\\\").replace(/[=;#]/g, "\\$&").replace(/\r?\n/g, " ");
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${start}`, `END=${Math.max(start + 1, end)}`, `title=${title}`);
  }
  fs.writeFileSync(output, `${lines.join("\n")}\n`);
  return output;
}
