// Nhân vật hoạt hình "bé Mon" – em bé lanh lợi, tóc cắt ngắn, mặc yếm jean xanh, tay cầm con Xe.
// monSVG({ mouth, blink, brow, tilt, wave }) trả về chuỗi <svg> (viewBox 400×520, cùng khung với coachSVG).
//   wave: 0..1 – nhấc con Xe lên cao (khi khoe phép thuật).

const M = {
  skin: '#F2C7A0', skinShade: '#DDA57E', skinLight: '#FBDDBF', blush: '#F28C8C',
  hair: '#1E1A1A', hairHi: '#3A3434',
  tee: '#EAF3FB', teeShade: '#BFD6EA',
  denim: '#4C6FA8', denimDark: '#3A5689', denimLine: '#7E9CCB', button: '#F4F4F4',
  eye: '#1A1210', mouthIn: '#6B2323', tongue: '#E07B7B', teeth: '#FFFFFF', lip: '#C46A5E',
  rook: '#FFFFFF', rookLine: '#2B2B2B',
};

function monSVG({ mouth = 0, blink = 0, brow = 0, tilt = 0, wave = 0 } = {}) {
  const m = Math.max(0, Math.min(1, mouth));
  const b = Math.max(0, Math.min(1, blink));
  const eyeR = 20 * (1 - b) + 1.5;
  const browY = -brow * 7;
  const mOpen = 8 + m * 26;
  const w = Math.max(0, Math.min(1, wave));
  const handY = 420 - w * 120, handX = 322 + w * 8;   // tay cầm Xe

  const rook = (x, y, s) => `
    <g transform="translate(${x} ${y}) scale(${s})" stroke="${M.rookLine}" stroke-width="2.4" stroke-linejoin="round">
      <path d="M -22 40 L 22 40 L 22 32 L -22 32 Z" fill="${M.rook}"/>
      <path d="M -16 32 L -13 -6 L 13 -6 L 16 32 Z" fill="${M.rook}"/>
      <path d="M -19 -6 L 19 -6 L 19 -14 L -19 -14 Z" fill="${M.rook}"/>
      <path d="M -19 -14 L -19 -28 L -11 -28 L -11 -21 L -4 -21 L -4 -28 L 4 -28 L 4 -21 L 11 -21 L 11 -28 L 19 -28 L 19 -14 Z" fill="${M.rook}"/>
      <path d="M -13 2 L 13 2 M -14 22 L 14 22" fill="none"/>
    </g>`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%">
  <defs>
    <radialGradient id="mFace" cx="0.45" cy="0.42" r="0.65">
      <stop offset="0" stop-color="${M.skinLight}"/><stop offset="0.7" stop-color="${M.skin}"/><stop offset="1" stop-color="${M.skinShade}"/>
    </radialGradient>
    <clipPath id="mMouthClip"><path d="M 168 334 Q 200 342 232 334 Q 226 ${334 + mOpen * 1.2} 200 ${336 + mOpen * 1.25} Q 174 ${334 + mOpen * 1.2} 168 334 Z"/></clipPath>
  </defs>

  <!-- thân: áo thun trắng xanh + yếm jean -->
  <path d="M 70 520 C 74 450 110 418 160 410 L 240 410 C 290 418 326 450 330 520 Z" fill="${M.tee}"/>
  <path d="M 84 470 C 96 440 120 424 150 418 L 140 470 Z" fill="${M.teeShade}" opacity=".6"/>
  <path d="M 128 520 L 136 452 L 264 452 L 272 520 Z" fill="${M.denim}"/>
  <path d="M 142 452 L 150 412 L 172 412 L 168 452 Z" fill="${M.denim}"/>
  <path d="M 258 452 L 250 412 L 228 412 L 232 452 Z" fill="${M.denim}"/>
  <circle cx="160" cy="458" r="7" fill="${M.button}" stroke="${M.denimDark}" stroke-width="2"/>
  <circle cx="240" cy="458" r="7" fill="${M.button}" stroke="${M.denimDark}" stroke-width="2"/>
  <path d="M 168 478 q 10 -8 18 0 t 18 0 M 214 494 q 8 -10 16 0 M 150 500 q 6 6 12 0" stroke="${M.denimLine}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- cổ -->
  <path d="M 178 372 L 178 414 Q 200 426 222 414 L 222 372 Z" fill="${M.skinShade}"/>

  <!-- tay phải cầm con Xe -->
  <path d="M 288 430 C 312 ${440 - w * 40} ${handX - 6} ${handY + 40} ${handX} ${handY + 10}" stroke="${M.tee}" stroke-width="40" fill="none" stroke-linecap="round"/>
  <path d="M ${handX - 2} ${handY + 22} L ${handX} ${handY + 6}" stroke="${M.skin}" stroke-width="30" stroke-linecap="round"/>
  ${rook(handX + 2, handY - 52, 1.55)}
  <ellipse cx="${handX}" cy="${handY + 4}" rx="17" ry="13" fill="${M.skin}" stroke="${M.skinShade}" stroke-width="2"/>

  <g transform="rotate(${tilt} 200 380)">
    <!-- tai vểnh -->
    <ellipse cx="96" cy="250" rx="24" ry="32" fill="${M.skinShade}"/>
    <ellipse cx="304" cy="250" rx="24" ry="32" fill="${M.skinShade}"/>
    <ellipse cx="99" cy="250" rx="12" ry="19" fill="${M.skin}"/>
    <ellipse cx="301" cy="250" rx="12" ry="19" fill="${M.skin}"/>

    <!-- đầu tròn, má phúng phính -->
    <path d="M 98 228 C 96 300 128 362 200 368 C 272 362 304 300 302 228 C 300 150 258 106 200 106 C 142 106 100 150 98 228 Z" fill="url(#mFace)"/>

    <!-- tóc húi cua -->
    <path d="M 106 214 C 100 150 136 102 200 100 C 264 102 300 150 294 214 C 290 186 282 168 268 158 C 236 150 214 160 196 156 C 172 152 150 156 132 166 C 118 178 110 194 106 214 Z" fill="${M.hair}"/>
    <path d="M 150 120 q 10 -6 20 0 M 190 112 q 10 -6 20 0 M 230 118 q 10 -6 20 0 M 172 136 q 10 -6 20 0 M 214 134 q 10 -6 20 0" stroke="${M.hairHi}" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- lông mày mảnh -->
    <g transform="translate(0 ${browY})">
      <path d="M 136 202 Q 154 192 172 198" stroke="${M.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M 264 202 Q 246 192 228 198" stroke="${M.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
    </g>

    <!-- mắt to tròn long lanh -->
    ${b < 0.75 ? `
    <ellipse cx="156" cy="244" rx="20" ry="${eyeR}" fill="${M.eye}"/>
    <ellipse cx="244" cy="244" rx="20" ry="${eyeR}" fill="${M.eye}"/>
    <circle cx="163" cy="236" r="7" fill="#fff"/><circle cx="251" cy="236" r="7" fill="#fff"/>
    <circle cx="150" cy="252" r="3.2" fill="#fff" opacity=".85"/><circle cx="238" cy="252" r="3.2" fill="#fff" opacity=".85"/>` : `
    <path d="M 138 246 Q 156 256 174 246" stroke="${M.eye}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M 226 246 Q 244 256 262 246" stroke="${M.eye}" stroke-width="5" fill="none" stroke-linecap="round"/>`}

    <!-- mũi nhỏ -->
    <path d="M 192 290 Q 200 298 208 290" stroke="${M.skinShade}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <!-- má hồng -->
    <ellipse cx="130" cy="296" rx="24" ry="14" fill="${M.blush}" opacity=".45"/>
    <ellipse cx="270" cy="296" rx="24" ry="14" fill="${M.blush}" opacity=".45"/>

    <!-- miệng cười toe -->
    <path d="M 168 334 Q 200 342 232 334 Q 226 ${334 + mOpen * 1.2} 200 ${336 + mOpen * 1.25} Q 174 ${334 + mOpen * 1.2} 168 334 Z" fill="${M.mouthIn}"/>
    <g clip-path="url(#mMouthClip)">
      <rect x="170" y="332" width="60" height="9" rx="3" fill="${M.teeth}"/>
      <ellipse cx="200" cy="${336 + mOpen * 1.15}" rx="16" ry="9" fill="${M.tongue}"/>
    </g>
    <path d="M 164 332 Q 200 344 236 332" stroke="${M.lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;
}

if (typeof module !== 'undefined') module.exports = { monSVG };
