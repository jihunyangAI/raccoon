// 코드로 그리는 벡터 스프라이트. 이미지 파일을 쓰지 않는다.
export type C = CanvasRenderingContext2D;

export const ell = (g: C, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) => {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  g.fill();
};
export const rr = (g: C, x: number, y: number, w: number, h: number, r: number, fill: string) => {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
};

const FUR = '#9499b3', FUR2 = '#7d829c', DARK = '#33364b', CREAM = '#f2eee4', CAPE = '#e8604c';
export const FRUIT = ['#ff5b4d', '#d9e14b', '#a866ff', '#ff9b3d'];
export const GOLD = '#ffd84a';

/** 루미 얼굴. mood: 0 보통, 1 웃음, 2 당황 */
export function head(g: C, x: number, y: number, s = 1, mood = 0) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  ell(g, -11, -15, 7, 8, DARK); ell(g, -11, -14, 3.5, 4.5, '#e9a3ad');
  ell(g, 11, -16, 7, 8, DARK); ell(g, 11, -15, 3.5, 4.5, '#e9a3ad');
  ell(g, 0, 0, 22, 18, FUR);
  ell(g, -3, -10, 10, 3.2, CREAM, -0.12);
  ell(g, 7, -1, 15, 7.5, DARK); // 눈가 무늬
  ell(g, 11, 8, 10, 6.5, CREAM);
  ell(g, 19, 5.5, 3.2, 2.6, '#20212c');
  g.strokeStyle = '#fff';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  if (mood === 1) {
    for (const ex of [5, 15]) { g.beginPath(); g.arc(ex, -1, 3, Math.PI, 0); g.stroke(); }
  } else if (mood === 2) {
    for (const ex of [5, 15]) {
      g.beginPath(); g.moveTo(ex - 3, -4); g.lineTo(ex + 3, 2); g.moveTo(ex + 3, -4); g.lineTo(ex - 3, 2); g.stroke();
    }
  } else {
    ell(g, 5, -2, 3.4, 4, '#fff'); ell(g, 6, -2, 1.9, 2.5, '#15161f');
    ell(g, 15, -2, 2.6, 3.4, '#fff'); ell(g, 15.8, -2, 1.5, 2, '#15161f');
  }
  g.restore();
}

function lantern(g: C, x: number, y: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = '#6b4423';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 6); g.stroke();
  rr(g, -6, 6, 12, 15, 3, '#6b4423');
  rr(g, -4, 8, 8, 11, 2, '#ffe08a');
  ell(g, 0, 13.5, 2.5, 3.5, '#fff7d0');
  g.restore();
}

export interface Pose {
  dir: number; state: string; run: number; climb: number; t: number;
  vx: number; vy: number; squash: number; stT: number;
}

/** 루미. (x, y)는 발밑 중앙 */
export function lumi(g: C, x: number, y: number, o: Pose) {
  g.save();
  g.translate(x, y);
  if (o.state === 'dead') { g.translate(0, -40); g.rotate(o.stT * 9 * o.dir); g.translate(0, 40); }
  if (o.state === 'cheer') g.translate(0, -Math.abs(Math.sin(o.stT * 7)) * 22);
  g.scale(1 + o.squash * 0.45, 1 - o.squash * 0.45);

  if (o.state === 'ladder') {
    // 사다리를 오르는 뒷모습
    const c = Math.sin(o.climb / 11);
    for (let i = 3; i >= 0; i--) ell(g, 12 + i * 5 + Math.sin(o.t * 3 + i) * 1.5, -14 + i * 8, 10 - i, 9 - i, i % 2 ? DARK : FUR2);
    ell(g, -9, -4 + c * 4, 7, 5, DARK); ell(g, 9, -4 - c * 4, 7, 5, DARK);
    ell(g, 0, -28, 17, 20, FUR);
    g.fillStyle = CAPE;
    g.beginPath(); g.moveTo(-12, -48); g.lineTo(12, -48); g.lineTo(16, -17); g.lineTo(-16, -17); g.closePath(); g.fill();
    ell(g, -16, -46 - c * 6, 6, 8, FUR2); ell(g, 16, -46 + c * 6, 6, 8, FUR2);
    ell(g, -11, -73, 7, 8, DARK); ell(g, 11, -73, 7, 8, DARK);
    ell(g, 0, -58, 22, 18, FUR); ell(g, 0, -62, 8, 10, FUR2);
    lantern(g, 20, -38, c * 0.12);
    g.restore();
    return;
  }

  g.scale(o.dir, 1);
  const vx = o.vx * o.dir;
  const moving = o.state === 'ground' && Math.abs(o.vx) > 30, air = o.state === 'air';
  const sw = moving ? Math.sin(o.run / 13) : 0;
  const bob = moving ? Math.abs(Math.cos(o.run / 13)) * 2.5 : Math.sin(o.t * 3) * 1.2;
  for (let i = 4; i >= 0; i--) {
    const ty = -22 - i * 6 + Math.sin(o.t * 5 + i * 0.7) * (1 + i * 0.6) - (air ? o.vy * 0.004 * i : 0);
    ell(g, -17 - i * 8.5, ty, 12 - Math.abs(i - 1.5) * 1.6, 11 - Math.abs(i - 1.5) * 1.5, i % 2 ? DARK : FUR2);
  }
  const fl = Math.min(16, Math.abs(vx) / 22) + Math.sin(o.t * 11) * 2;
  g.fillStyle = CAPE;
  g.beginPath();
  g.moveTo(-3, -50 - bob);
  g.quadraticCurveTo(-16 - fl, -44, -22 - fl, -20 - (air ? o.vy * 0.012 : 0));
  g.lineTo(-6, -18);
  g.closePath();
  g.fill();
  if (air) { ell(g, -7, -5, 7, 5, DARK, 0.4); ell(g, 8, -7, 7, 5, DARK, -0.3); }
  else {
    ell(g, -6 + sw * 9, -3 - Math.max(0, -sw) * 4, 8, 4.5, DARK);
    ell(g, 6 - sw * 9, -3 - Math.max(0, sw) * 4, 8, 4.5, DARK);
  }
  ell(g, 0, -27 - bob, 16, 19, FUR);
  ell(g, 4, -24 - bob, 10, 13, CREAM);
  const cheer = o.state === 'cheer';
  head(g, 3, -58 - bob, 1, o.state === 'dead' ? 2 : cheer ? 1 : 0);
  const hx = cheer ? 16 : 20, hy = cheer ? -68 : -32 - bob + sw * 2;
  g.strokeStyle = FUR2;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(5, -36 - bob); g.lineTo(hx, hy); g.stroke();
  if (cheer) { g.beginPath(); g.moveTo(-5, -36); g.lineTo(-14, -66); g.stroke(); }
  lantern(g, hx + 2, hy + 3, Math.sin(o.t * 4) * 0.15 - vx * 0.0007);
  g.restore();
}

export function fruit(g: C, x: number, y: number, kind: number, gold: boolean, t: number) {
  const c = gold ? GOLD : FRUIT[kind], r = gold ? 17 : 14, pear = kind === 1 && !gold;
  g.save();
  g.translate(x, y + Math.sin(t * 3 + x * 0.01) * 3);
  if (gold) {
    g.save();
    g.rotate(t * 1.5);
    g.fillStyle = '#fff6c8';
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.beginPath(); g.moveTo(0, -r - 11); g.lineTo(4, -r + 2); g.lineTo(-4, -r + 2); g.fill();
    }
    g.restore();
  }
  if (pear) { ell(g, 0, 3, r, r * 0.95, c); ell(g, 0, -9, r * 0.6, r * 0.7, c); }
  else ell(g, 0, 0, r, r * (kind === 2 ? 1.1 : 0.95), c);
  ell(g, -r * 0.35, -r * 0.35, r * 0.28, r * 0.2, 'rgba(255,255,255,.75)', -0.6);
  const top = -r - (pear ? 8 : 0);
  g.strokeStyle = '#5a3a22';
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(0, top + 2); g.lineTo(2, top - 7); g.stroke();
  ell(g, 8, top - 5, 6, 3, '#6fc35a', -0.5);
  g.restore();
}

const BOXGLOW = { bonus: '#ffd36b', time: '#d6e89a', wisp: '#ffbf8f' };
const BOXMARK = { bonus: '★', time: '+', wisp: '!' };
let colorSafe = false;
export const isColorSafe = () => colorSafe;

/** 색맹 모드: 구분하기 쉬운 색으로 바꾸고 상자에 기호를 표시한다 */
export function setColorSafe(on: boolean) {
  colorSafe = on;
  FRUIT.splice(0, 4, ...(on ? ['#d55e00', '#f0e442', '#cc79a7', '#56b4e9'] : ['#ff5b4d', '#d9e14b', '#a866ff', '#ff9b3d']));
  Object.assign(BOXGLOW, on
    ? { bonus: '#f0e442', time: '#56b4e9', wisp: '#d55e00' }
    : { bonus: '#ffd36b', time: '#d6e89a', wisp: '#ffbf8f' });
}

/** 등불 상자. 창의 빛깔이 내용물의 단서다 */
export function box(g: C, x: number, y: number, content: 'bonus' | 'time' | 'wisp', open: boolean, t: number) {
  g.save();
  g.translate(x, y);
  rr(g, -22, -38, 44, 38, 6, '#8a5a34');
  rr(g, -22, -38, 44, 8, 4, '#6b4423');
  rr(g, -22, -8, 44, 8, 4, '#6b4423');
  if (open) {
    rr(g, -12, -27, 24, 16, 4, '#2a2030');
    g.save(); g.translate(-22, -40); g.rotate(-0.5); rr(g, 0, -8, 44, 8, 4, '#a06c40'); g.restore();
  } else {
    g.globalAlpha = 0.85 + Math.sin(t * 4 + x) * 0.15;
    rr(g, -12, -27, 24, 16, 4, BOXGLOW[content]);
    g.globalAlpha = 1;
    g.fillStyle = '#6b4423';
    if (colorSafe) {
      g.fillStyle = '#17132a';
      g.font = '900 15px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(BOXMARK[content], 0, -18.5);
    } else g.fillRect(-1.5, -27, 3, 16);
    rr(g, -24, -44, 48, 8, 4, '#a06c40');
  }
  g.restore();
}

export function burr(g: C, x: number, y: number) {
  g.save();
  g.translate(x, y - 19);
  g.fillStyle = '#c8e05a';
  g.strokeStyle = '#2c3a12';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, r = i % 2 ? 12 : 22;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.stroke();
  g.fill();
  ell(g, 0, 0, 12, 12, '#93ad3c');
  ell(g, -4, -4, 4, 3, '#e6f59a');
  g.restore();
}

export function hog(g: C, x: number, y: number, dir: number, t: number) {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  const s = Math.sin(t * 14);
  ell(g, -10 + s * 3, -3, 6, 4, '#3d2f26'); ell(g, 10 - s * 3, -3, 6, 4, '#3d2f26');
  g.fillStyle = '#4a382c';
  g.beginPath();
  for (let i = 0; i <= 9; i++) {
    const a = Math.PI + (i / 9) * Math.PI;
    g.lineTo(Math.cos(a) * 20 - 3, Math.sin(a) * 22 - 8);
    g.lineTo(Math.cos(a + 0.17) * 30 - 3, Math.sin(a + 0.17) * 32 - 8);
  }
  g.lineTo(17, -8);
  g.closePath();
  g.fill();
  ell(g, -3, -14, 21, 14, '#6e5645');
  ell(g, 15, -11, 11, 9, '#ecd0a8');
  ell(g, 25, -10, 3, 2.6, '#20212c');
  ell(g, 16, -14, 2.4, 2.8, '#20212c');
  g.restore();
}

export function bat(g: C, x: number, y: number, t: number) {
  g.save();
  g.translate(x, y);
  const f = Math.sin(t * 18) * 0.7;
  g.fillStyle = '#4a3278';
  for (const s of [-1, 1]) {
    g.save();
    g.scale(s, 1);
    g.rotate(f * 0.6);
    g.beginPath();
    g.moveTo(4, -2); g.lineTo(34, -14); g.lineTo(28, -2); g.lineTo(32, 8); g.lineTo(20, 3); g.lineTo(14, 10); g.lineTo(4, 6);
    g.closePath();
    g.fill();
    g.restore();
  }
  ell(g, -6, -12, 4, 7, '#5a3d8a', -0.3); ell(g, 6, -12, 4, 7, '#5a3d8a', 0.3);
  ell(g, 0, 0, 12, 12, '#5a3d8a');
  ell(g, -4, -2, 2.6, 3, '#ffe36b'); ell(g, 4, -2, 2.6, 3, '#ffe36b');
  g.restore();
}

export function owl(g: C, x: number, y: number, dir: number, state: string, t: number) {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  const dash = state === 'dash', alert = state === 'alert';
  if (alert) g.translate(Math.sin(t * 60) * 2, 0);
  if (dash) { g.translate(0, -28); g.rotate(0.9); g.translate(0, 28); }
  const wing = dash ? 1 : 0;
  ell(g, -18 - wing * 10, -30, 10 + wing * 12, 20 - wing * 8, '#6f5238', -0.2 - wing);
  ell(g, 18 + wing * 10, -30, 10 + wing * 12, 20 - wing * 8, '#6f5238', 0.2 + wing);
  ell(g, 0, -28, 22, 28, '#8a6a4a');
  ell(g, 0, -20, 14, 17, '#d8bf98');
  g.fillStyle = '#8a6a4a';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8, -52); g.lineTo(s * 20, -64); g.lineTo(s * 18, -46); g.fill(); }
  const eye = alert || dash ? '#ff6a4a' : '#ffe36b';
  ell(g, -8, -40, 9, 9, '#fff'); ell(g, 8, -40, 9, 9, '#fff');
  ell(g, -7, -40, alert ? 3 : 5, alert ? 3 : 5, eye); ell(g, 9, -40, alert ? 3 : 5, alert ? 3 : 5, eye);
  ell(g, -7, -40, 2, 2, '#15161f'); ell(g, 9, -40, 2, 2, '#15161f');
  g.fillStyle = '#f0a03c';
  g.beginPath(); g.moveTo(-3, -33); g.lineTo(5, -33); g.lineTo(1, -25); g.fill();
  g.restore();
  if (alert) {
    g.fillStyle = '#ff6a4a';
    g.font = '900 44px sans-serif';
    g.textAlign = 'center';
    g.fillText('!', x, y - 78);
  }
}

export function wisp(g: C, x: number, y: number, life: number, t: number) {
  g.save();
  g.translate(x, y);
  g.globalAlpha = Math.min(1, life * 1.5, (3.4 - life) * 3 + 0.2);
  const k = 1 + Math.sin(t * 12) * 0.08;
  g.scale(k, 2 - k);
  g.fillStyle = '#8dffc0';
  g.beginPath();
  g.moveTo(0, -30 + Math.sin(t * 9) * 3);
  g.bezierCurveTo(18, -8, 20, 14, 0, 18);
  g.bezierCurveTo(-20, 14, -18, -8, 0, -30 + Math.sin(t * 9) * 3);
  g.fill();
  ell(g, 0, 4, 11, 11, '#e6fff0');
  g.strokeStyle = '#1d5a44';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(-3, 3); g.moveTo(8, 0); g.lineTo(3, 3); g.stroke();
  g.beginPath(); g.arc(0, 7, 4, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
}
