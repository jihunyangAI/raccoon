// 스테이지별 배경. 게임 화면과 스테이지 선택 그림이 같은 그림을 쓴다.
// 좌표는 w(가로), h(바닥 높이) 기준이며 건물과 풍경은 바닥에서 위로 그린다.
import { ell, rr, type C } from './draw';

type Rand = () => number;
export interface Theme {
  name: string;
  sky: [string, string, string];
  far: string;
  mid: string;
  stars: number;
  paint: (g: C, w: number, h: number, r: Rand, t: Theme) => void;
}

const LIT = '#ffcf7a';

function poly(g: C, color: string, pts: number[]) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

function line(g: C, color: string, width: number, pts: number[]) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

function hill(g: C, w: number, h: number, base: number, amp: number, ph: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) g.lineTo(x, h - base - Math.sin(x * 0.004 + ph) * amp);
  g.lineTo(w, h);
  g.fill();
}

function tree(g: C, x: number, y: number, s: number, color: string, r: Rand, fruit = 'rgba(255,110,90,.55)') {
  g.fillStyle = color;
  g.fillRect(x - 12 * s, y - 130 * s, 24 * s, 132 * s);
  for (const [dx, dy, q] of [[-52, -150, 62], [52, -155, 64], [0, -205, 70], [0, -130, 58]]) ell(g, x + dx * s, y + dy * s, q * s, q * s * 0.88, color);
  for (let i = 0; i < 6; i++) ell(g, x + (r() - 0.5) * 170 * s, y - (120 + r() * 120) * s, 8 * s, 8 * s, fruit);
}

function cloud(g: C, x: number, y: number, s: number, color: string) {
  for (let i = 0; i < 5; i++) ell(g, x + (i - 2) * 58 * s, y + (i % 2) * 12 * s, 66 * s, (30 + (i % 2) * 12) * s, color);
}

function fence(g: C, x0: number, x1: number, y: number, color: string) {
  line(g, color, 7, [x0, y - 34, x1, y - 34]);
  line(g, color, 7, [x0, y - 16, x1, y - 16]);
  for (let x = x0; x <= x1; x += 54) line(g, color, 9, [x, y, x, y - 48]);
}

function windowsOf(g: C, x: number, y: number, cols: number, rows: number, gap: number, color = LIT) {
  for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) rr(g, x + i * gap, y + k * gap, 24, 30, 6, color);
}

function lantern(g: C, x: number, y: number, s: number, color: string) {
  ell(g, x, y, 34 * s, 34 * s, color + '33');
  rr(g, x - 13 * s, y - 16 * s, 26 * s, 32 * s, 9 * s, color);
}

function flower(g: C, x: number, base: number, top: number, s: number, stem: string, petal: string) {
  line(g, stem, 12 * s, [x, base, x + 18 * s, (base + top) / 2, x, top]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ell(g, x + Math.cos(a) * 44 * s, top + Math.sin(a) * 44 * s, 36 * s, 17 * s, petal, a);
  }
  ell(g, x, top, 22 * s, 22 * s, LIT);
}

function mushroom(g: C, x: number, y: number, s: number, stem: string, cap: string) {
  rr(g, x - 20 * s, y - 120 * s, 40 * s, 122 * s, 14 * s, stem);
  g.fillStyle = cap;
  g.beginPath();
  g.ellipse(x, y - 116 * s, 92 * s, 72 * s, 0, Math.PI, 0);
  g.fill();
  for (const dx of [-46, 0, 44]) ell(g, x + dx * s, y - 146 * s + Math.abs(dx) * 0.3 * s, 10 * s, 8 * s, 'rgba(255,255,255,.45)');
}

function gear(g: C, x: number, y: number, q: number, color: string, hole: string, rot: number) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = rot + (i / 24) * Math.PI * 2, e = i % 4 < 2 ? q : q * 0.8;
    g.lineTo(x + Math.cos(a) * e, y + Math.sin(a) * e);
  }
  g.closePath();
  g.fill();
  ell(g, x, y, q * 0.34, q * 0.34, hole);
}

function wheel(g: C, x: number, y: number, q: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 14;
  g.beginPath(); g.arc(x, y, q, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = 0.3 + (i / 8) * Math.PI * 2;
    line(g, color, 9, [x, y, x + Math.cos(a) * q, y + Math.sin(a) * q]);
    ell(g, x + Math.cos(a) * (q + 12), y + Math.sin(a) * (q + 12), 20, 11, color, a + Math.PI / 2);
  }
}

function arches(g: C, x0: number, x1: number, top: number, bottom: number, span: number, color: string, hole: string) {
  g.fillStyle = color;
  g.fillRect(x0, top, x1 - x0, bottom - top);
  for (let x = x0 + span / 2; x < x1; x += span) {
    g.fillStyle = hole;
    g.beginPath();
    g.moveTo(x - span * 0.34, bottom);
    g.lineTo(x - span * 0.34, top + span * 0.5);
    g.arc(x, top + span * 0.5, span * 0.34, Math.PI, 0);
    g.lineTo(x + span * 0.34, bottom);
    g.fill();
  }
}

const skyHole = (t: Theme) => t.sky[2];

const ORCHARD: Theme[] = [
  { name: '노을 언덕', sky: ['#1c1640', '#6a2f5e', '#d9745a'], far: '#54305f', mid: '#2c1d46', stars: 0.5, paint(g, w, h, r, t) {
    hill(g, w, h, 150, 70, 1.4, t.mid);
    for (const q of [0.14, 0.34, 0.8]) tree(g, w * q, h - 190 - Math.sin(w * q * 0.004 + 1.4) * 70, 0.85, t.mid, r);
    fence(g, w * 0.46, w * 0.68, h - 170, t.mid);
  } },
  { name: '풍차 마루', sky: ['#0b1a3a', '#1d3f6a', '#4f7f8f'], far: '#1b3a5c', mid: '#10223f', stars: 1, paint(g, w, h, r, t) {
    hill(g, w, h, 130, 50, 3.6, t.mid);
    const x = w * 0.68, y = h - 150;
    poly(g, t.mid, [x - 74, y, x - 42, y - 300, x + 42, y - 300, x + 74, y]);
    poly(g, t.mid, [x - 56, y - 296, x, y - 368, x + 56, y - 296]);
    rr(g, x - 14, y - 210, 28, 38, 12, LIT);
    for (let i = 0; i < 4; i++) {
      const a = 0.5 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), cy = y - 300;
      line(g, t.mid, 10, [x, cy, x + c * 210, cy + s * 210]);
      poly(g, t.mid, [x + c * 60, cy + s * 60, x + c * 210, cy + s * 210, x + c * 210 - s * 46, cy + s * 210 + c * 46, x + c * 60 - s * 46, cy + s * 60 + c * 46]);
    }
    tree(g, w * 0.2, h - 130, 0.8, t.mid, r);
  } },
  { name: '등불 오두막', sky: ['#140f30', '#2f2258', '#6a4578'], far: '#32255c', mid: '#1b1538', stars: 1, paint(g, w, h, r, t) {
    hill(g, w, h, 110, 36, 0.4, t.mid);
    const x = w * 0.3, y = h - 130;
    rr(g, x - 130, y - 150, 260, 152, 6, t.mid);
    poly(g, t.mid, [x - 170, y - 146, x, y - 280, x + 170, y - 146]);
    g.fillStyle = t.mid; g.fillRect(x + 70, y - 270, 36, 90);
    for (let i = 0; i < 4; i++) ell(g, x + 92 + i * 22, y - 300 - i * 48, 20 + i * 8, 15 + i * 6, 'rgba(255,255,255,.1)');
    windowsOf(g, x - 84, y - 104, 2, 1, 136);
    tree(g, w * 0.72, h - 120, 1.25, t.mid, r);
  } },
  { name: '안개 과수원', sky: ['#10243a', '#2c4a5c', '#7a9a94'], far: '#3f6068', mid: '#1c3644', stars: 0.3, paint(g, w, h, r, t) {
    for (let x = 40; x < w; x += 230) tree(g, x, h - 200, 0.65, '#31505c', r, 'rgba(255,150,120,.3)');
    for (let i = 0; i < 5; i++) cloud(g, r() * w, h - 210 + r() * 40, 2, 'rgba(210,230,225,.07)');
    for (let x = 130; x < w; x += 360) tree(g, x, h - 70, 1.05, t.mid, r);
    for (let i = 0; i < 4; i++) cloud(g, r() * w, h - 90 + r() * 40, 2.4, 'rgba(210,230,225,.08)');
  } },
  { name: '별똥별 들판', sky: ['#050822', '#121a4a', '#2a2f70'], far: '#171f55', mid: '#0c1136', stars: 1.6, paint(g, w, h, r, t) {
    for (let i = 0; i < 6; i++) {
      const x = 120 + r() * (w - 320), y = 60 + r() * h * 0.36;
      line(g, 'rgba(255,255,255,.14)', 5, [x, y, x + 170, y + 66]);
      line(g, 'rgba(255,245,200,.75)', 6, [x + 150, y + 58, x + 170, y + 66]);
    }
    hill(g, w, h, 100, 28, 2.2, t.mid);
    for (const q of [0.2, 0.3, 0.62]) {
      const x = w * q, y = h - 110;
      g.fillStyle = t.mid;
      g.beginPath(); g.ellipse(x, y, 74, 92, 0, Math.PI, 0); g.fill();
    }
    fence(g, w * 0.72, w * 0.96, h - 110, t.mid);
  } },
  { name: '천년 사과나무', sky: ['#0d1a2a', '#1e3a3c', '#4a6a4a'], far: '#20403c', mid: '#112620', stars: 0.8, paint(g, w, h, r, t) {
    const x = w * 0.52, top = h * 0.2;
    poly(g, t.mid, [x - 170, h, x - 84, top + 120, x + 84, top + 120, x + 170, h]);
    for (const [dx, dy, q] of [[-330, 90, 190], [330, 100, 200], [-150, -20, 210], [170, -10, 220], [0, 170, 240], [-480, 240, 130], [480, 250, 130]]) ell(g, x + dx, top + dy, q, q * 0.72, t.mid);
    for (let i = 0; i < 26; i++) ell(g, x + (r() - 0.5) * 1040, top + r() * 340 - 90, 11, 11, 'rgba(255,100,85,.55)');
    rr(g, x - 26, h * 0.62, 52, 66, 26, LIT);
  } },
];

const GREENHOUSE: Theme[] = [
  { name: '유리 돔', sky: ['#07202b', '#123c44', '#2a6a5a'], far: '#10353c', mid: '#0b2930', stars: 0.8, paint(g, w, h, _r, t) {
    const x = w / 2, y = h - 40, q = Math.min(w * 0.46, 620);
    ell(g, x, y, q, q, 'rgba(150,240,220,.05)');
    g.strokeStyle = t.mid; g.lineWidth = 15;
    for (const k of [1, 0.72, 0.42, 0.12]) { g.beginPath(); g.ellipse(x, y, q * k, q, 0, Math.PI, 0); g.stroke(); }
    for (const k of [0.3, 0.6, 0.85]) { g.beginPath(); g.ellipse(x, y - q * k, q * Math.sqrt(1 - k * k), 24, 0, 0, Math.PI * 2); g.stroke(); }
  } },
  { name: '수련 연못', sky: ['#061c2e', '#0f3f52', '#2f7f7f'], far: '#0f3a4a', mid: '#092634', stars: 0.7, paint(g, w, h, r, t) {
    ell(g, w / 2, h - 30, w * 0.48, 190, t.mid);
    for (let i = 0; i < 12; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.8, y = h - 40 - r() * 130, q = 34 + r() * 30;
      ell(g, x, y, q, q * 0.36, '#17574f');
      if (i % 3 === 0) for (let p = -2; p <= 2; p++) ell(g, x + p * 9, y - 18 + Math.abs(p) * 3, 7, 19, '#f3a8c6', p * 0.32);
    }
    arches(g, 0, 150, 0, h, 150, t.mid, 'rgba(0,0,0,0)');
    g.fillStyle = t.mid; g.fillRect(w - 120, 0, 120, h);
  } },
  { name: '거인 꽃밭', sky: ['#1a1238', '#3a2460', '#8a4a80'], far: '#3a2562', mid: '#201540', stars: 0.8, paint(g, w, h, r, t) {
    const petals = ['#a85a9c', '#c56f7c', '#7f62c4', '#c78a50'];
    for (let i = 0; i < 6; i++) flower(g, w * (0.09 + i * 0.165), h, h - 260 - r() * 230, 1 + r() * 0.7, t.mid, petals[i % 4]);
  } },
  { name: '빛버섯 숲', sky: ['#0a1a24', '#1a3038', '#3f5a4a'], far: '#1a333a', mid: '#0f2229', stars: 0.5, paint(g, w, h, r, t) {
    const caps = ['#2e9c8c', '#5a7fd0', '#3fae72'];
    for (let i = 0; i < 7; i++) mushroom(g, w * (0.06 + i * 0.145), h - 10, 1 + (i % 3) * 0.55 + r() * 0.3, t.mid, caps[i % 3]);
    for (let i = 0; i < 20; i++) ell(g, r() * w, h - r() * 420, 4, 4, 'rgba(180,255,220,.5)');
  } },
  { name: '등불 정자', sky: ['#0f2620', '#1f4a38', '#5a8a50'], far: '#1f4636', mid: '#112c23', stars: 0.6, paint(g, w, h, _r, t) {
    const x = w * 0.58, y = h - 30;
    rr(g, x - 240, y - 26, 480, 30, 8, t.mid);
    for (const dx of [-190, -64, 64, 190]) { g.fillStyle = t.mid; g.fillRect(x + dx - 11, y - 270, 22, 250); }
    poly(g, t.mid, [x - 290, y - 262, x - 120, y - 370, x, y - 430, x + 120, y - 370, x + 290, y - 262]);
    for (const dx of [-127, 0, 127]) { line(g, t.mid, 4, [x + dx, y - 268, x + dx, y - 222]); lantern(g, x + dx, y - 198, 1, LIT); }
    line(g, t.mid, 14, [0, h - 330, w * 0.1, h - 250, w * 0.2, h - 300, w * 0.32, h - 210]);
    for (let i = 0; i < 6; i++) ell(g, w * (0.03 + i * 0.052), h - 300 + (i % 2) * 34, 34, 15, t.mid, i);
  } },
  { name: '덩굴 탑', sky: ['#08181f', '#103038', '#226058'], far: '#0f3036', mid: '#091f25', stars: 0.8, paint(g, w, h, _r, t) {
    const x = w * 0.5, top = h * 0.08, q = 170;
    g.strokeStyle = t.mid; g.lineWidth = 16;
    g.strokeRect(x - q, top, q * 2, h - top);
    for (let y = top; y < h; y += 170) line(g, t.mid, 12, [x - q, y, x + q, y + 170, x + q, y, x - q, y + 170]);
    poly(g, t.mid, [x - q - 44, top + 6, x, top - 120, x + q + 44, top + 6]);
    g.strokeStyle = '#1e6a55'; g.lineWidth = 12; g.beginPath();
    for (let y = top; y <= h; y += 20) g.lineTo(x + Math.sin(y * 0.018) * (q + 12), y);
    g.stroke();
    for (let y = top + 20; y < h; y += 52) ell(g, x + Math.sin(y * 0.018) * (q + 12), y, 26, 12, '#2a8366', y);
  } },
];

const VALLEY: Theme[] = [
  { name: '큰 폭포', sky: ['#0b1430', '#1c3460', '#3a5f8a'], far: '#182c54', mid: '#101f3e', stars: 1, paint(g, w, h, r, t) {
    poly(g, t.mid, [0, h, 0, h - 680, w * 0.26, h - 640, w * 0.32, h - 300, w * 0.36, h]);
    poly(g, t.mid, [w, h, w, h - 720, w * 0.62, h - 650, w * 0.58, h - 300, w * 0.54, h]);
    for (let i = 0; i < 9; i++) {
      const x = w * 0.27 + i * w * 0.042;
      g.fillStyle = i % 2 ? 'rgba(190,225,255,.2)' : 'rgba(190,225,255,.11)';
      g.fillRect(x, h - 650, w * 0.043, 650);
    }
    for (let i = 0; i < 6; i++) cloud(g, w * 0.3 + r() * w * 0.3, h - 20 - r() * 40, 1, 'rgba(225,240,255,.09)');
  } },
  { name: '돌다리', sky: ['#101a36', '#2a3a66', '#6a6a90'], far: '#2b3963', mid: '#182342', stars: 0.9, paint(g, w, h, _r, t) {
    arches(g, -20, w + 20, h - 400, h, 300, t.mid, skyHole(t));
    for (let x = 30; x < w; x += 150) rr(g, x, h - 438, 74, 42, 6, t.mid);
    g.fillStyle = 'rgba(100,150,210,.3)'; g.fillRect(0, h - 44, w, 44);
  } },
  { name: '물방앗간', sky: ['#14182e', '#2e3358', '#7a6070'], far: '#303558', mid: '#1b1f3a', stars: 0.8, paint(g, w, h, _r, t) {
    const x = w * 0.42, y = h - 30;
    g.fillStyle = t.mid; g.fillRect(x - 170, y - 240, 340, 242);
    poly(g, t.mid, [x - 210, y - 234, x, y - 390, x + 210, y - 234]);
    windowsOf(g, x - 100, y - 170, 3, 1, 88);
    wheel(g, x + 280, y - 110, 130, '#2a2e4e');
    line(g, t.mid, 26, [x + 240, y - 300, w, y - 330]);
  } },
  { name: '하늘 수로', sky: ['#0a1c30', '#17405a', '#3f8090'], far: '#17405a', mid: '#0e2a40', stars: 0.7, paint(g, w, h, _r, t) {
    arches(g, -20, w + 20, h - 620, h, 220, t.mid, skyHole(t));
    g.fillStyle = 'rgba(130,200,240,.4)'; g.fillRect(0, h - 640, w, 18);
    for (const x of [w * 0.3, w * 0.72]) { g.fillStyle = 'rgba(170,220,250,.2)'; g.fillRect(x, h - 620, 26, 620); }
  } },
  { name: '수정 동굴', sky: ['#0c0a24', '#1e1a48', '#3c3078'], far: '#201b4c', mid: '#120f30', stars: 0, paint(g, w, h, r, t) {
    g.fillStyle = t.mid; g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= w + 90; x += 90) { g.lineTo(x + 45, 90 + r() * 180); g.lineTo(x + 90, 50 + r() * 40); }
    g.lineTo(w, 0); g.fill();
    const col = ['#6fd0e8', '#a884f0', '#e088d0'];
    for (let i = 0; i < 12; i++) {
      const x = r() * w, q = 26 + r() * 36, tall = 90 + r() * 190, c = col[i % 3];
      ell(g, x, h - tall / 2, q * 2.4, tall * 0.8, c + '18');
      poly(g, c + 'aa', [x - q, h, x - q * 0.7, h - tall * 0.72, x, h - tall, x + q * 0.7, h - tall * 0.72, x + q, h]);
      poly(g, 'rgba(255,255,255,.22)', [x - q * 0.2, h, x - q * 0.2, h - tall * 0.8, x, h - tall, x + q * 0.1, h]);
    }
  } },
  { name: '톱니 수문탑', sky: ['#0f1626', '#223048', '#48607a'], far: '#223049', mid: '#151f33', stars: 0.8, paint(g, w, h, _r, t) {
    const x = w * 0.5, top = h * 0.1;
    g.fillStyle = t.mid; g.fillRect(x - 170, top, 340, h - top);
    rr(g, x - 210, top - 34, 420, 44, 8, t.mid);
    for (let y = top + 90, i = 0; y < h - 80; y += 300, i++) {
      gear(g, x + (i % 2 ? -210 : 210), y + 70, 124, '#26344e', t.sky[1], i * 0.3);
      windowsOf(g, x - 62, y, 2, 1, 100);
    }
    g.fillStyle = 'rgba(170,215,250,.17)'; g.fillRect(x - 36, h * 0.72, 72, h * 0.28);
  } },
];

const SUMMIT: Theme[] = [
  { name: '눈 봉우리', sky: ['#150f38', '#3a2a6c', '#8a5a8a'], far: '#2c235c', mid: '#1f1848', stars: 1, paint(g, w, h, _r, t) {
    for (const [q, tall, base] of [[0.2, 560, 380], [0.54, 700, 470], [0.86, 500, 340]]) {
      const x = w * q;
      poly(g, t.mid, [x - base, h, x, h - tall, x + base, h]);
      poly(g, 'rgba(235,230,255,.75)', [x - 76, h - tall + 112, x, h - tall, x + 76, h - tall + 112, x + 30, h - tall + 86, x - 6, h - tall + 126, x - 34, h - tall + 92]);
    }
  } },
  { name: '구름 바다', sky: ['#1a1a50', '#4a4a98', '#b08ab8'], far: '#4c4a96', mid: '#35347c', stars: 0.6, paint(g, w, h, r) {
    [['rgba(255,255,255,.1)', 400], ['rgba(255,255,255,.15)', 270], ['rgba(255,255,255,.22)', 130]].forEach(([c, y], layer) => {
      for (let x = -80; x < w + 200; x += 280) cloud(g, x + r() * 90 + layer * 70, h - Number(y) + r() * 34, 1.5 + layer * 0.35, String(c));
    });
  } },
  { name: '별빛 천문대', sky: ['#0c0c30', '#22205a', '#55407e'], far: '#23215c', mid: '#14133c', stars: 1.5, paint(g, w, h, _r, t) {
    hill(g, w, h, 130, 40, 1, t.mid);
    const x = w * 0.64, y = h - 160;
    g.fillStyle = t.mid; g.fillRect(x - 140, y - 170, 280, 172);
    g.beginPath(); g.arc(x, y - 170, 150, Math.PI, 0); g.fill();
    line(g, t.mid, 44, [x + 34, y - 250, x + 190, y - 390]);
    line(g, '#fff3c8', 8, [x + 174, y - 408, x + 206, y - 372]);
    windowsOf(g, x - 76, y - 110, 3, 1, 64);
    for (const [a, b] of [[0.14, 0.3], [0.2, 0.2], [0.27, 0.27], [0.33, 0.16]]) ell(g, w * a, h * b, 6, 6, '#fff3c8');
    line(g, 'rgba(255,243,200,.3)', 3, [w * 0.14, h * 0.3, w * 0.2, h * 0.2, w * 0.27, h * 0.27, w * 0.33, h * 0.16]);
  } },
  { name: '떠 있는 섬', sky: ['#101a4a', '#2c3f8a', '#7a7ac0'], far: '#2b3c84', mid: '#19245c', stars: 0.9, paint(g, w, h, r, t) {
    for (const [q, y, s] of [[0.2, 0.62, 1.1], [0.52, 0.36, 1.45], [0.84, 0.68, 0.9]]) {
      const x = w * q, top = h * y;
      poly(g, t.mid, [x - 190 * s, top, x + 190 * s, top, x + 110 * s, top + 74 * s, x + 30 * s, top + 180 * s, x - 66 * s, top + 96 * s]);
      rr(g, x - 200 * s, top - 12 * s, 400 * s, 24 * s, 12 * s, '#5f6fc0');
      tree(g, x + 40 * s, top, 0.5 * s, t.mid, r, 'rgba(255,220,150,.6)');
      line(g, 'rgba(255,255,255,.14)', 4, [x + 180 * s, top + 8, x + 180 * s, top + 240 * s]);
    }
  } },
  { name: '오로라 고원', sky: ['#04101f', '#0c2a3f', '#184a55'], far: '#0d3040', mid: '#07202c', stars: 1.4, paint(g, w, h, _r, t) {
    const band = (y: number, amp: number, ph: number, c: string) => {
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = c; g.lineWidth = 30 + i * 22; g.lineCap = 'round'; g.beginPath();
        for (let x = -30; x <= w + 30; x += 40) g.lineTo(x, y + Math.sin(x * 0.005 + ph) * amp + i * 20);
        g.stroke();
      }
    };
    band(h * 0.2, 80, 0.4, 'rgba(90,255,170,.045)');
    band(h * 0.34, 64, 2.2, 'rgba(160,110,255,.04)');
    hill(g, w, h, 90, 34, 2.6, t.mid);
    for (let x = 60; x < w; x += 170) poly(g, t.mid, [x - 46, h - 80, x, h - 240 - (x % 3) * 22, x + 46, h - 80]);
  } },
  { name: '달맞이 첨탑', sky: ['#1a0f3a', '#452a70', '#a0608a'], far: '#432a6c', mid: '#28194c', stars: 1, paint(g, w, h, _r, t) {
    const x = w * 0.5, top = h * 0.07;
    poly(g, t.mid, [x - 250, h, x - 60, top + 170, x, top, x + 60, top + 170, x + 250, h]);
    let side = -1;
    for (let y = h - 80; y > top + 230; y -= 220) {
      const half = 60 + ((y - top - 170) / (h - top - 170)) * 190;
      line(g, '#3d2a68', 12, [x + side * half, y, x - side * half, y - 190]);
      lantern(g, x + side * (half + 34), y - 12, 0.8, LIT);
      side = -side;
    }
    ell(g, x, top + 12, 16, 16, '#fff3c8');
  } },
];

const FESTIVAL: Theme = {
  name: '등불 축제', sky: ['#2a1240', '#6a2a5a', '#d0704a'], far: '#5a2752', mid: '#2e1838', stars: 0.5,
  paint(g, w, h, r, t) {
    const colors = ['#ffcf7a', '#ff8a7a', '#8dffc0', '#9fd8ff'];
    for (let row = 0; row < 3; row++) {
      const y0 = h * (0.2 + row * 0.2), sag = 70;
      g.strokeStyle = 'rgba(255,230,190,.3)'; g.lineWidth = 4; g.beginPath();
      for (let x = 0; x <= w; x += 20) g.lineTo(x, y0 + Math.abs(Math.sin((x / w) * Math.PI * 3 + row)) * sag);
      g.stroke();
      for (let x = 50 + row * 40; x < w; x += 130) lantern(g, x, y0 + Math.abs(Math.sin((x / w) * Math.PI * 3 + row)) * sag + 24, 0.8, colors[Math.floor(r() * 4)]);
    }
    hill(g, w, h, 80, 26, 1, t.mid);
  },
};

const ZONE_THEMES = [ORCHARD, GREENHOUSE, VALLEY, SUMMIT];

/** zone은 1~4, k는 구역 안 순서(0~5). 보너스 스테이지는 축제 배경을 쓴다 */
export const themeFor = (zone: number, k: number, bonus = false): Theme =>
  bonus ? FESTIVAL : ZONE_THEMES[zone - 1][k % 6];

export function paintSky(g: C, w: number, h: number, t: Theme) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, t.sky[0]);
  sky.addColorStop(0.6, t.sky[1]);
  sky.addColorStop(1, t.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
}

/** 가장 먼 능선. 높은 구역일수록 뾰족하다 */
export function paintFar(g: C, w: number, h: number, t: Theme, zone: number, r: Rand) {
  const a = r() * 6, b = r() * 6, sharp = zone >= 3 ? 0.9 : 0.25;
  for (const [base, amp, color] of [[330, 110, t.far], [190, 60, t.mid + 'aa']] as const) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) {
      const ridge = Math.sin(x * 0.0035 + a + base) * amp + (1 - Math.abs(Math.sin(x * 0.009 + b))) * amp * sharp;
      g.lineTo(x, h - base - ridge);
    }
    g.lineTo(w, h);
    g.fill();
  }
}
