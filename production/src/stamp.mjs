// Content stamps so a rebuild can skip a stage whose inputs and outputs are unchanged.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { OUT, ROOT } from "./config.mjs";

export function digest(parts) {
  const h = crypto.createHash("sha1");
  for (const p of parts) {
    h.update(typeof p === "string" ? p : JSON.stringify(p));
    h.update("\0");
  }
  return h.digest("hex");
}

export function fileDigest(files) {
  const h = crypto.createHash("sha1");
  for (const f of [...files].sort()) {
    h.update(path.relative(ROOT, f));
    h.update("\0");
    h.update(fs.readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex");
}

export function engineFiles() {
  const dir = path.join(ROOT, "src/engine");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => path.join(dir, f));
}

function stampPath(n, stage) {
  return path.join(OUT, "stamps", `episode-0${n}-${stage}.json`);
}

export function isFresh(n, stage, hash, outputs) {
  const file = stampPath(n, stage);
  if (!fs.existsSync(file)) return false;
  let prev;
  try {
    prev = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  if (prev.hash !== hash) return false;
  return outputs.every((o) => fs.existsSync(o) && fs.statSync(o).size > 0);
}

export function markFresh(n, stage, hash, outputs) {
  const file = stampPath(n, stage);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ hash, outputs, at: new Date().toISOString() }, null, 2));
}
