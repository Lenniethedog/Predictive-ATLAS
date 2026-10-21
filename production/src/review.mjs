// Local listening page with the spoken text and the previous read for comparison.
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./config.mjs";

const episodes = [];
const preview = process.argv.includes("--preview");
const filmDirectory = preview ? "previews" : "video";
const filmSuffix = preview ? "-preview" : "";
const filmLabel = preview ? "Watch the updated preview" : "Watch the full-resolution episode";
const previousRead = fs.existsSync(path.join(OUT, "archive/narration-v6")) ? "narration-v6" : "narration-v5";
for (const n of [1, 2, 3, 4, 5]) {
  const ep = (await import(`./episodes/ep${n}.mjs`)).default;
  const timing = JSON.parse(fs.readFileSync(path.join(OUT, "timing", `episode-0${n}.json`), "utf8"));
  episodes.push({ n, title: ep.title, scenes: ep.scenes.map((s, i) => ({
    title: s.title, text: s.narration, start: timing.paragraphs[i].start, end: timing.paragraphs[i].end,
  })) });
}
const data = JSON.stringify(episodes).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Predictive Atlas · Narration review</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b1017;color:#e7eef5;font:17px/1.65 system-ui,sans-serif}
main{max-width:920px;margin:40px auto;padding:0 24px}h1{font-size:30px;line-height:1.3}h2{font-size:19px;margin:0 0 6px}
label,.muted{color:#a2b2c2}select{display:block;margin:8px 0 24px;padding:10px;font:inherit;width:100%;background:#151e2b;color:inherit;border:1px solid #38506a;border-radius:6px}
audio{width:100%;margin:8px 0 20px}a{color:#66dcff}.player{position:sticky;top:0;background:#0b1017;padding:14px 0;border-bottom:1px solid #283748;z-index:1}
details{margin:12px 0 24px}article{border-left:3px solid transparent;padding:14px 18px;margin:14px 0;border-radius:5px;cursor:pointer}article.active{border-color:#66dcff;background:#141e2a}article p{margin:0}.time{font-size:13px;color:#91a7be}
</style><main><h1>Predictive Atlas · Narration review</h1>
<label for="episode">Choose an episode</label><select id="episode"></select>
<section class="player"><h2 id="title"></h2><audio id="current" controls preload="metadata"></audio>
<a id="film">Watch the updated preview</a></section>
<details><summary>Compare with the previous read</summary><audio id="previous" controls preload="none"></audio></details>
<p class="muted">Select a passage to hear it. The current passage highlights as the narration plays.</p><section id="script"></section></main>
<script>
const episodes=${data};
const select=document.getElementById('episode'), current=document.getElementById('current'), previous=document.getElementById('previous'), script=document.getElementById('script');
for(const ep of episodes){const o=document.createElement('option');o.value=ep.n;o.textContent=ep.n+' · '+ep.title;select.append(o)}
function show(){const ep=episodes[Number(select.value)-1], pad=String(ep.n).padStart(2,'0');current.pause();previous.pause();document.getElementById('title').textContent=ep.title;current.src='audio/episode-'+pad+'-narration.mp3';previous.src='archive/${previousRead}/audio/episode-'+pad+'-narration.mp3';document.getElementById('film').href='${filmDirectory}/episode-'+pad+'${filmSuffix}.mp4';document.getElementById('film').textContent='${filmLabel}';script.replaceChildren();for(const scene of ep.scenes){const a=document.createElement('article'),h=document.createElement('h2'),p=document.createElement('p'),t=document.createElement('span');h.textContent=scene.title;p.textContent=scene.text;t.className='time';t.textContent=Math.floor(scene.start/60)+':'+String(Math.floor(scene.start%60)).padStart(2,'0');a.dataset.start=scene.start;a.dataset.end=scene.end;a.append(t,h,p);a.addEventListener('click',()=>{previous.pause();current.currentTime=scene.start;current.play().catch(()=>{})});script.append(a)}}
current.addEventListener('play',()=>previous.pause());previous.addEventListener('play',()=>current.pause());current.addEventListener('timeupdate',()=>{for(const a of script.children)a.classList.toggle('active',current.currentTime>=Number(a.dataset.start)&&current.currentTime<Number(a.dataset.end))});select.addEventListener('change',show);show();
</script></html>`;
fs.writeFileSync(path.join(OUT, "review.html"), html);
console.log(path.join(OUT, "review.html"));
