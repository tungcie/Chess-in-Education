// Render video từ timeline: node tools/render.js episodes/01-khai-cuoc [--stills 2,9,20] [--out file.mp4]
// Mỗi khung hình được vẽ bằng renderAt(t) trong src/player.html rồi chụp lại, đưa vào ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ep = path.resolve(process.argv[2]);
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const tl = JSON.parse(fs.readFileSync(path.join(ep, 'build', 'timeline.json'), 'utf8'));

// Gộp 12 quân cờ thành <symbol> để dùng lại trong SVG bàn cờ
const pieces = fs.readdirSync(path.join(root, 'assets/pieces')).filter(f => f.endsWith('.svg')).map(f => {
  const svg = fs.readFileSync(path.join(root, 'assets/pieces', f), 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<symbol id="${f.replace('.svg', '')}" viewBox="0 0 45 45">${inner}</symbol>`;
}).join('');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(root, 'src/player.html'));
  await page.evaluate(([t, p]) => window.setup(t, p), [tl, pieces]);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => (i.onload = i.onerror = r)))));

  const stills = arg('--stills');
  if (stills) {
    const dir = path.join(ep, 'build', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of stills.split(',').map(Number)) {
      await page.evaluate(t => renderAt(t), s);
      await page.screenshot({ path: path.join(dir, `t${String(s).padStart(5, '0')}.png`) });
    }
    console.log('stills →', dir); await browser.close(); return;
  }

  const out = arg('--out') || path.join(ep, 'build', 'video.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', path.join(ep, 'build', 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.ceil(tl.duration * tl.fps);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => renderAt(t), f / tl.fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) process.stdout.write(`\r${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('\nvideo →', out);
})();
