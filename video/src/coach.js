// Nhân vật hoạt hình "HLV Tùng" – vẽ bằng SVG để có thể điều khiển từng khung hình.
// coachSVG({ mouth, blink, brow, tilt }) trả về chuỗi <svg>.
//   mouth: 0 (ngậm) → 1 (mở to), blink: 0 (mở mắt) → 1 (nhắm), brow: -1..1 (nhíu/nhướn), tilt: độ nghiêng đầu.

const C = {
  skin: '#E9B98F', skinShade: '#D49D72', skinLight: '#F3CDA6',
  hair: '#17171B', hairHi: '#34343C',
  shirt: '#141416', shirtHi: '#26262A', collar: '#0B0B0C',
  gold: '#F2C230', goldDeep: '#C9921A',
  lip: '#B5655A', mouthIn: '#5A1F1F', teeth: '#FFFFFF', tongue: '#D9776E',
  eye: '#1C1410', white: '#FFFFFF', line: '#3A2418',
};

function coachSVG({ mouth = 0, blink = 0, brow = 0, tilt = 0, logo = 'assets/logo.png' } = {}) {
  const m = Math.max(0, Math.min(1, mouth));
  const b = Math.max(0, Math.min(1, blink));
  const eyeH = 13 * (1 - b) + 1.2;          // chiều cao mắt
  const browY = -brow * 6;                    // nhướn mày
  const mOpen = 6 + m * 26;                   // độ mở miệng
  const mW = 30 - m * 5;                      // nửa bề rộng miệng

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%">
  <defs>
    <linearGradient id="cShirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.shirtHi}"/><stop offset="1" stop-color="${C.shirt}"/>
    </linearGradient>
    <radialGradient id="cFace" cx="0.45" cy="0.4" r="0.7">
      <stop offset="0" stop-color="${C.skinLight}"/><stop offset="0.65" stop-color="${C.skin}"/><stop offset="1" stop-color="${C.skinShade}"/>
    </radialGradient>
    <clipPath id="cMouthClip"><path d="M ${200 - mW} 314 Q 200 324 ${200 + mW} 314 Q 200 ${322 + mOpen * 1.3} ${200 - mW} 314 Z"/></clipPath>
  </defs>

  <!-- Thân + áo polo đen -->
  <path d="M 40 520 C 46 440 92 410 150 398 L 250 398 C 308 410 354 440 360 520 Z" fill="url(#cShirt)"/>
  <path d="M 150 398 L 200 470 L 250 398 Z" fill="${C.skinShade}"/>
  <!-- cổ -->
  <path d="M 170 330 L 170 410 Q 200 432 230 410 L 230 330 Z" fill="${C.skinShade}"/>
  <!-- cổ áo -->
  <path d="M 146 396 L 200 470 L 176 476 L 132 414 Z" fill="${C.collar}"/>
  <path d="M 254 396 L 200 470 L 224 476 L 268 414 Z" fill="${C.collar}"/>
  <rect x="195" y="470" width="10" height="50" fill="${C.collar}"/>
  <circle cx="200" cy="488" r="3.2" fill="#3C3C40"/><circle cx="200" cy="508" r="3.2" fill="#3C3C40"/>
  <!-- logo Chess Empire trên ngực -->
  ${logo ? `<image href="${logo}" x="268" y="440" width="36" height="54" preserveAspectRatio="xMidYMid meet"/>` : ''}

  <g transform="rotate(${tilt} 200 360)">
    <!-- tai -->
    <ellipse cx="106" cy="236" rx="16" ry="25" fill="${C.skinShade}"/>
    <ellipse cx="294" cy="236" rx="16" ry="25" fill="${C.skinShade}"/>
    <ellipse cx="108" cy="236" rx="7" ry="14" fill="${C.skin}" opacity=".7"/>
    <ellipse cx="292" cy="236" rx="7" ry="14" fill="${C.skin}" opacity=".7"/>

    <!-- mặt: hàm vuông nhẹ -->
    <path d="M 112 190 C 112 268 126 322 166 352 Q 200 372 234 352 C 274 322 288 268 288 190 C 286 128 250 104 200 104 C 150 104 114 128 112 190 Z" fill="url(#cFace)"/>

    <!-- tóc: hai bên cắt ngắn, đỉnh vuốt dựng ra sau (quiff) -->
    <path d="M 110 222 C 100 168 108 120 140 94 C 160 66 214 52 252 62 C 290 72 306 108 300 150 C 300 178 296 200 290 222
             C 288 192 284 170 274 156 C 252 140 222 136 196 138 C 166 140 138 148 124 168 C 116 184 112 202 110 222 Z" fill="${C.hair}"/>
    <path d="M 146 100 C 178 74 236 66 272 86" stroke="${C.hairHi}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M 164 122 C 196 104 244 104 280 122" stroke="${C.hairHi}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>

    <!-- lông mày đậm -->
    <g transform="translate(0 ${browY})">
      <path d="M 136 196 Q 160 182 186 190" stroke="${C.hair}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M 264 196 Q 240 182 214 190" stroke="${C.hair}" stroke-width="9" fill="none" stroke-linecap="round"/>
    </g>

    <!-- mắt (hơi híp khi cười) -->
    <g>
      <ellipse cx="162" cy="222" rx="14" ry="${eyeH * 0.85}" fill="${C.white}"/>
      <ellipse cx="238" cy="222" rx="14" ry="${eyeH * 0.85}" fill="${C.white}"/>
      ${b < 0.7 ? `
      <circle cx="163" cy="223" r="${Math.min(8.5, eyeH)}" fill="${C.eye}"/>
      <circle cx="239" cy="223" r="${Math.min(8.5, eyeH)}" fill="${C.eye}"/>
      <circle cx="166" cy="219" r="2.5" fill="#fff"/><circle cx="242" cy="219" r="2.5" fill="#fff"/>` : ''}
      <path d="M 147 ${222 - eyeH * 0.85} Q 162 ${213 - eyeH * 0.85} 177 ${222 - eyeH * 0.85}" stroke="${C.line}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M 223 ${222 - eyeH * 0.85} Q 238 ${213 - eyeH * 0.85} 253 ${222 - eyeH * 0.85}" stroke="${C.line}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M 150 236 Q 162 241 175 236" stroke="${C.skinShade}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 225 236 Q 238 241 250 236" stroke="${C.skinShade}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>

    <!-- mũi -->
    <path d="M 200 232 Q 197 262 188 276 Q 200 284 212 276" stroke="${C.skinShade}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <!-- má hồng -->
    <ellipse cx="144" cy="270" rx="16" ry="9" fill="#E8907A" opacity=".25"/>
    <ellipse cx="256" cy="270" rx="16" ry="9" fill="#E8907A" opacity=".25"/>

    <!-- miệng: luôn hơi cười -->
    <path d="M ${200 - mW} 314 Q 200 324 ${200 + mW} 314 Q 200 ${322 + mOpen * 1.3} ${200 - mW} 314 Z" fill="${C.mouthIn}"/>
    <g clip-path="url(#cMouthClip)">
      <rect x="150" y="312" width="100" height="${8 + m * 3}" fill="${C.teeth}"/>
      <ellipse cx="200" cy="${320 + mOpen * 1.05}" rx="18" ry="9" fill="${C.tongue}"/>
    </g>
    <path d="M ${200 - mW - 3} 312 Q 200 ${326 + mOpen * 1.2} ${200 + mW + 3} 312" stroke="${C.lip}" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- ria mép + chòm râu cằm -->
    <path d="M 168 304 Q 184 292 200 297 Q 216 292 232 304 Q 216 300 200 304 Q 184 300 168 304 Z" fill="${C.hair}"/>
    <path d="M 188 ${352 + m * 6} Q 200 ${358 + m * 6} 212 ${352 + m * 6} Q 208 ${370 + m * 6} 200 ${372 + m * 6} Q 192 ${370 + m * 6} 188 ${352 + m * 6} Z" fill="${C.hair}"/>
  </g>
</svg>`;
}

if (typeof module !== 'undefined') module.exports = { coachSVG };
