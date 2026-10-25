// Xem thử nhân vật ở vài trạng thái: node tools/preview-character.js <coach|mon> out.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const name = process.argv[2];
  const fn = require(`../src/${name}.js`)[`${name}SVG`];
  const states = [{}, { mouth: 0.6 }, { mouth: 1, brow: 0.8, wave: 1 }, { blink: 1, tilt: -4, wave: 0.5 }];
  const html = `<html><body style="margin:0;background:#2a2a30;display:flex">${states
    .map(s => `<div style="width:400px;height:520px">${fn({ ...s, logo: 'assets/logo.png' })}</div>`).join('')}</body></html>`;
  const tmp = path.join(root, '.preview.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 520 } });
  await p.goto('file://' + tmp); await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[3] }); await b.close(); fs.unlinkSync(tmp);
})();
