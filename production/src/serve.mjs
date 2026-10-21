// Local player server with byte-range support so the video can be rewound
// and skipped. Python's http.server on this machine does not honor Range.
//
//   node src/serve.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const PLAYER = path.join(ROOT, "player.html");
const PORT = Number(process.argv[2] || 8765);

const TYPES = {
  ".mp4": "video/mp4",
  ".html": "text/html; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

function fileFor(urlPath) {
  const rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "/player.html") return PLAYER;
  const file = path.normalize(path.join(OUT, rel));
  if (!file.startsWith(OUT)) return null;
  return file;
}

function send(req, res, file, stat) {
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    res.end();
    return;
  }
  let start = match[1] === "" ? 0 : Number(match[1]);
  let end = match[2] === "" ? stat.size - 1 : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= stat.size || end < start) {
    res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    res.end();
    return;
  }
  end = Math.min(end, stat.size - 1);
  res.writeHead(206, {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Content-Length": end - start + 1,
    "Cache-Control": "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(file, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  const file = fileFor(req.url || "/");
  if (!file) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    send(req, res, file, stat);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`player http://127.0.0.1:${PORT}/player.html`);
});
