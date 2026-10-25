// Xem thử nhân vật: node tools/preview-coach.js out.png
const { chromium } = require('playwright');
const path = require('path');
const { coachSVG } = require('../src/coach.js');
(async () => {
  const root = path.resolve(__dirname, '..');
  const states = [{}, { mouth: 0.6 }, { mouth: 1, brow: 0.8 }, { blink: 1, tilt: -4 }];
  const html = `<html><body style="margin:0;background:#2a2a30;display:flex">${states
    .map(s => `<div style="width:400px;height:520px">${coachSVG(s)}</div>`).join('')}</body></html>`;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 520 } });
  const tmp = path.join(root, '.preview.html');
  require('fs').writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[2] }); await b.close();
})();
