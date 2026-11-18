import { COLS, FONT, H, T, W, rng } from '../core/const';
import { JUMP_BTN, PAUSE_BTN, STICK_HOME, type Input } from '../core/input';
import { vineSway, type Run, type World } from '../physics/world';
import type { Stage } from '../stages/types';
import { paintFar, paintSky, themeFor, type Theme } from './backgrounds';
import * as D from './draw';

type C = CanvasRenderingContext2D;

export const ZNAME = ['사과 언덕', '덩굴 온실', '물레방아 골짜기', '달맞이 꼭대기'];
export const ZONES = [
  { body: '#96643f', dark: '#5f3d28', top: '#79c466', ladder: '#d2a064', darkA: 0.4 },
  { body: '#3d8f88', dark: '#255f5c', top: '#a8ead8', ladder: '#5fbf6a', darkA: 0.42 },
  { body: '#7a89a6', dark: '#4c5873', top: '#62b488', ladder: '#c9b58a', darkA: 0.42 },
  { body: '#cfc6f0', dark: '#9a8fc8', top: '#ffffff', ladder: '#f0d48a', darkA: 0.36 },
];

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = Math.ceil(h);
  return c;
};

const glowCache = new Map<string, HTMLCanvasElement>();
/** 빛 번짐 스프라이트. color는 #rrggbb */
function glow(color: string) {
  let c = glowCache.get(color);
  if (!c) {
    c = mk(128, 128);
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color);
    gr.addColorStop(0.35, color + '99');
    gr.addColorStop(1, color + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowCache.set(color, c);
  }
  return c;
}

interface Part {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; g: number; add: boolean; text?: string;
}

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
};

export class Renderer {
  shakeOn = true;
  low = false; // 느린 기기에서 빛 효과를 줄인다
  camY = 0;
  private shake = 0;
  private maxCam = 0;
  private st!: Stage;
  private theme!: Theme;
  private stars = mk(W, H);
  private far!: HTMLCanvasElement;
  private mid!: HTMLCanvasElement;
  private plat!: HTMLCanvasElement;
  private dark = mk(W / 2, H / 2);
  private dg = this.dark.getContext('2d')!;
  private special: number[] = [];
  private parts: Part[] = [];
  private flies: { x: number; y: number; a: number; s: number }[] = [];

  constructor(private g: C) {}

  /** 스테이지가 바뀔 때 정적인 레이어를 미리 그려 둔다 */
  build(st: Stage) {
    this.st = st;
    const wh = st.rows * T, r = rng(st.id * 31 + st.zone * 7 + (st.bonus ? 99 : 5));
    const theme = (this.theme = themeFor(st.zone, st.id % 6, st.bonus));
    this.maxCam = wh - H;
    this.camY = this.maxCam;
    this.parts = [];
    this.shake = 0;

    const sg = this.stars.getContext('2d')!;
    sg.clearRect(0, 0, W, H);
    for (let i = 0; i < 170 * theme.stars; i++) {
      sg.globalAlpha = 0.25 + r() * 0.75;
      D.ell(sg, r() * W, r() * H * 0.8, 0.8 + r() * 1.8, 0.8 + r() * 1.8, '#ffffff');
    }
    sg.globalAlpha = 1;

    // 먼 능선
    const fh = H + this.maxCam * 0.2;
    this.far = mk(W, fh);
    paintFar(this.far.getContext('2d')!, W, fh, theme, st.zone, r);

    // 중간 배경: 스테이지마다 다른 장소
    const mh = H + this.maxCam * 0.5;
    this.mid = mk(W, mh);
    theme.paint(this.mid.getContext('2d')!, W, mh, r, theme);

    // 발판과 사다리
    this.plat = mk(W, wh);
    const pg = this.plat.getContext('2d')!;
    this.special = [];
    for (const row of st.floors) {
      let s = -1;
      for (let c = 0; c <= COLS; c++) {
        const v = c < COLS ? st.tiles[row * COLS + c] : 0;
        if (v >= 2) this.special.push(row * COLS + c);
        if (v === 1 && s < 0) s = c;
        if (v !== 1 && s >= 0) { this.runPlat(pg, s * T, row * T, (c - s) * T, row === st.rows - 1, r); s = -1; }
      }
    }
    if (st.zone !== 2) for (const l of st.ladders) this.ladder(pg, l.x, l.top, l.bottom, ZONES[st.zone - 1].ladder);

    this.flies = [];
    for (let i = 0; i < 26; i++) this.flies.push({ x: r() * W, y: r() * wh, a: r() * 6.28, s: 0.5 + r() });
  }

  private runPlat(g: C, x: number, y: number, w: number, bottom: boolean, r: () => number) {
    const z = ZONES[this.st.zone - 1], zone = this.st.zone;
    if (bottom) { g.fillStyle = z.dark; g.fillRect(x, y + 12, w, T); }
    const gr = g.createLinearGradient(0, y, 0, y + 28);
    gr.addColorStop(0, z.body);
    gr.addColorStop(1, z.dark);
    g.fillStyle = gr;
    g.beginPath(); g.roundRect(x, y, w, 28, bottom ? 0 : 9); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.2)';
    g.lineWidth = 2;
    for (let sx = x + T; sx < x + w - 4; sx += T) { g.beginPath(); g.moveTo(sx, y + 9); g.lineTo(sx, y + 26); g.stroke(); }
    if (zone === 2) for (let sx = x + 14; sx < x + w; sx += 30) D.ell(g, sx, y + 17, 3, 3, 'rgba(255,255,255,.35)');
    if (zone === 2 && !bottom) { g.fillStyle = 'rgba(170,240,230,.14)'; g.fillRect(x + 8, y + 28, w - 16, 12); }
    if (zone === 4 && !bottom) for (let sx = x + 16; sx < x + w - 6; sx += 26) D.ell(g, sx, y + 28, 18, 9 + r() * 5, '#e6defc');
    D.rr(g, x - 2, y - 4, w + 4, 11, 5, z.top);
    if (zone === 1) {
      g.fillStyle = z.top;
      for (let sx = x + 6; sx < x + w - 6; sx += 10 + r() * 16) {
        g.beginPath(); g.moveTo(sx - 4, y - 2); g.lineTo(sx, y - 9 - r() * 7); g.lineTo(sx + 4, y - 2); g.fill();
      }
    }
    if (zone === 3) for (let sx = x + 8; sx < x + w - 8; sx += 18 + r() * 30) D.rr(g, sx, y + 2, 9, 8 + r() * 14, 4, z.top);
    if (bottom) for (let k = 0; k < w / 26; k++) D.ell(g, x + r() * w, y + 38 + r() * 26, 4 + r() * 5, 3, 'rgba(0,0,0,.18)');
  }

  private ladder(g: C, x: number, top: number, bottom: number, color: string) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineWidth = 6;
    for (const s of [-15, 15]) { g.beginPath(); g.moveTo(x + s, top - 20); g.lineTo(x + s, bottom - 2); g.stroke(); }
    g.lineWidth = 4;
    for (let y = bottom - 16; y > top - 14; y -= 22) { g.beginPath(); g.moveTo(x - 15, y); g.lineTo(x + 15, y); g.stroke(); }
  }

  /** 게임 이벤트를 파티클로 */
  spawn(type: string, x: number, y: number, arg?: number | string) {
    const burst = (n: number, color: string, sp: number, size: number, grav = 300, add = true) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, v = sp * (0.4 + Math.random() * 0.6);
        this.parts.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: 0, max: 0.4 + Math.random() * 0.4,
          size: size * (0.6 + Math.random() * 0.6), color, g: grav, add,
        });
      }
    };
    const text = (s: string, color = '#ffffff') =>
      this.parts.push({ x, y, vx: 0, vy: -70, life: 0, max: 0.9, size: 30, color, g: 0, add: false, text: s });
    switch (type) {
      case 'pick': burst(8, '#fff2a8', 220, 5); break;
      case 'gold': burst(28, '#ffd84a', 380, 7); break;
      case 'jump': case 'land': burst(5, '#d8d2e8', 90, 6, -20, false); break;
      case 'die': burst(24, '#ff8a7a', 420, 7); if (this.shakeOn) this.shake = 16; break;
      case 'crumble': burst(6, '#c9b79a', 120, 6, 500, false); break;
      case 'bonus': burst(18, '#ffcf5a', 320, 6); break;
      case 'time': burst(18, '#9fd8ff', 320, 6); break;
      case 'wisp': burst(18, '#8dffc0', 300, 6); break;
      case 'clear': for (const c of ['#ffd84a', '#ff8a7a', '#9fd8ff', '#8dffc0']) burst(12, c, 520, 7); break;
      case 'text': text(String(arg), '#ffffff'); break;
      case 'life': text('1UP', '#8dffc0'); break;
    }
  }

  update(dt: number, w?: World) {
    this.shake = Math.max(0, this.shake - dt * 40);
    for (const p of this.parts) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const f of this.flies) {
      f.a += (Math.random() - 0.5) * dt * 4;
      f.x += Math.cos(f.a) * 24 * dt;
      f.y += Math.sin(f.a) * 16 * dt;
    }
    if (!w) return;
    const target = Math.max(0, Math.min(this.maxCam, w.p.y - 640));
    this.camY += (target - this.camY) * Math.min(1, dt * 6);
    if (w.windF > 0.3 && Math.random() < dt * 60) {
      this.parts.push({
        x: Math.random() * W, y: this.camY + Math.random() * H, vx: w.windDir * 1300, vy: 0, life: 0, max: 0.35,
        size: 3, color: '#ffffff', g: 0, add: true,
      });
    }
  }

  /** 하늘, 달, 원경. ratio는 남은 시간 비율 (달의 높이) */
  backdrop(ratio: number, t: number, moonAt?: [number, number]) {
    const g = this.g, k = 1 - Math.max(0, Math.min(1, ratio));
    paintSky(g, W, H, this.theme);
    g.globalAlpha = 0.75 + Math.sin(t * 1.3) * 0.15;
    g.drawImage(this.stars, 0, 0);
    g.globalAlpha = 1;
    const mx = moonAt ? moonAt[0] : 1520 - k * 1000, my = moonAt ? moonAt[1] : 180 + Math.pow(k, 1.6) * 640;
    const moon = k > 0.8 ? '#ffb47a' : '#fff3c8';
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.55;
    g.drawImage(glow(moon), mx - 260, my - 260, 520, 520);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    D.ell(g, mx, my, 64, 64, moon);
    D.ell(g, mx - 18, my - 14, 14, 11, 'rgba(0,0,0,.07)');
    D.ell(g, mx + 22, my + 16, 18, 14, 'rgba(0,0,0,.06)');
    D.ell(g, mx + 10, my - 30, 8, 6, 'rgba(0,0,0,.06)');
    g.drawImage(this.far, 0, -this.camY * 0.2);
    g.drawImage(this.mid, 0, -this.camY * 0.5);
  }

  /** 메뉴 화면용 반딧불 */
  ambient(t: number) {
    const g = this.g;
    g.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      g.globalAlpha = 0.35 + Math.sin(t * 2 * f.s + f.a) * 0.3;
      g.drawImage(glow('#e8ff9a'), ((f.x % W) + W) % W - 14, (((f.y - this.camY) % H) + H) % H - 14, 28, 28);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  draw(w: World, a: number, t: number) {
    const g = this.g, st = w.st, z = ZONES[st.zone - 1], p = w.p, cam = this.camY;
    const lx = (o: { x: number; px: number }) => o.px + (o.x - o.px) * a;
    const ly = (o: { y: number; py: number }) => o.py + (o.y - o.py) * a;
    const px = lx(p), py = ly(p);
    const vis = (y: number) => y > cam - 120 && y < cam + H + 120;
    this.backdrop(st.bonus ? 0.9 : w.timeLeft / st.time, t);

    const L: [number, number, number, string, number][] = []; // 빛: x, y, 반지름, 색, 세기
    g.save();
    g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake - cam);
    g.drawImage(this.plat, 0, cam, W, H, 0, cam, W, H);

    for (const s of st.streams) {
      const y = s.row * T, x0 = s.c0 * T, wd = (s.c1 - s.c0 + 1) * T;
      D.rr(g, x0, y - 7, wd, 14, 7, 'rgba(90,170,255,.6)');
      g.strokeStyle = 'rgba(220,240,255,.85)';
      g.lineWidth = 3;
      g.lineCap = 'round';
      const off = ((w.t * 150 * s.dir) % 40 + 40) % 40;
      for (let x = x0 + off; x < x0 + wd - 8; x += 40) {
        if (x < x0 + 8) continue;
        g.beginPath(); g.moveTo(x - 5 * s.dir, y - 4); g.lineTo(x, y); g.lineTo(x - 5 * s.dir, y + 4); g.stroke();
      }
    }

    for (const i of this.special) {
      const c = i % COLS, x = c * T, y = ((i - c) / COLS) * T;
      if (!vis(y)) continue;
      if (st.tiles[i] === 2) {
        const ct = w.crumbleT[i];
        if (ct >= 0.5 && ct < 4.1) {
          g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.setLineDash([6, 6]);
          g.strokeRect(x + 4, y + 2, T - 8, 20); g.setLineDash([]);
          continue;
        }
        const ox = ct > 0 && ct < 0.5 ? Math.sin(ct * 90) * 3 : 0;
        g.globalAlpha = ct >= 4.1 ? (ct - 4.1) / 0.4 : 1;
        D.rr(g, x + ox + 2, y, T - 4, 24, 6, z.dark);
        D.rr(g, x + ox + 2, y - 3, T - 4, 9, 4, '#e2cfa6');
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + ox + 18, y - 2); g.lineTo(x + ox + 26, y + 10); g.lineTo(x + ox + 20, y + 22);
        g.moveTo(x + ox + 42, y); g.lineTo(x + ox + 36, y + 14); g.stroke();
        g.globalAlpha = 1;
      } else {
        const ph = (w.t + st.phase[i]) % 4.2;
        g.globalAlpha = ph < 2.2 ? 1 : ph < 2.8 ? (Math.sin(ph * 30) > 0 ? 1 : 0.45) : 0.13;
        D.ell(g, x + 30, y + 13, 34, 14, '#ffffff');
        D.ell(g, x + 14, y + 8, 17, 12, '#f1ecff');
        D.ell(g, x + 46, y + 9, 18, 13, '#f1ecff');
        g.globalAlpha = 1;
      }
    }

    for (const m of w.movers) {
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.setLineDash([4, 10]);
      g.beginPath(); g.moveTo(m.x0, m.y + 12); g.lineTo(m.x1 + m.w, m.y + 12); g.stroke(); g.setLineDash([]);
      const x = lx(m);
      D.rr(g, x, m.y, m.w, 24, 9, z.body);
      D.rr(g, x - 2, m.y - 4, m.w + 4, 10, 5, '#ffd36b');
      D.ell(g, x + 16, m.y + 16, 5, 5, z.dark); D.ell(g, x + m.w - 16, m.y + 16, 5, 5, z.dark);
    }

    if (st.zone === 2) {
      // 덩굴: 바람에 흔들리지만 사다리처럼 오를 수 있다
      for (const l of st.ladders) {
        if (!vis(l.top) && !vis(l.bottom)) continue;
        g.strokeStyle = z.ladder; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath();
        for (let y = l.top - 20; y <= l.bottom; y += 12) {
          const x = l.x + vineSway(y, l.top, w.t);
          if (y === l.top - 20) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        for (let y = l.top, k = 0; y < l.bottom - 10; y += 26, k++) {
          const x = l.x + vineSway(y, l.top, w.t), s = k % 2 ? 1 : -1;
          D.ell(g, x + s * 13, y + 6, 11, 6, '#7ed488', s * 0.5);
        }
      }
    }

    for (const b of st.boxes) {
      if (!vis(b.y)) continue;
      D.box(g, b.x, b.y, b.content, b.open, t);
      if (!b.open) L.push([b.x, b.y - 20, 110, '#ffd36b', 0.35]);
    }
    for (const f of st.fruits) {
      if (f.got || !vis(f.y)) continue;
      D.fruit(g, f.x, f.y, f.kind, f.gold, t);
      L.push([f.x, f.y, f.gold ? 130 : 78, f.gold ? D.GOLD : D.FRUIT[f.kind], f.gold ? 0.7 : 0.45]);
    }
    for (const b of st.burrs) if (vis(b.y)) { D.burr(g, b.x, b.y); L.push([b.x, b.y - 19, 60, '#c8e05a', 0.18]); }
    for (const h of w.hogs) D.hog(g, lx(h), h.y, h.dir, w.t);
    for (const b of w.bats) D.bat(g, lx(b), ly(b), w.t);
    for (const o of w.owls) D.owl(g, lx(o), o.y, o.dir, o.state, w.t);
    for (const ws of w.wisps) { D.wisp(g, lx(ws), ly(ws), ws.life, w.t); L.push([ws.x, ws.y, 120, '#8dffc0', 0.5]); }
    if (D.isColorSafe()) {
      // 색맹 모드: 위험한 것에는 흰 테두리를 두른다
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.setLineDash([8, 6]);
      const ring = (x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); };
      for (const b of st.burrs) if (vis(b.y)) ring(b.x, b.y - 19, 29);
      for (const h of w.hogs) ring(lx(h), h.y - 16, 36);
      for (const b of w.bats) ring(lx(b), ly(b), 38);
      for (const o of w.owls) ring(lx(o), o.y - 32, 44);
      for (const ws of w.wisps) ring(lx(ws), ly(ws), 32);
      g.setLineDash([]);
    }

    if (!(p.invuln > 0 && Math.floor(w.t * 14) % 2)) {
      D.lumi(g, px, py, { dir: p.dir, state: p.state, run: p.run, climb: p.climb, t: w.t, vx: p.vx, vy: p.vy, squash: p.squash, stT: p.stT });
    }
    L.push([px + (p.state === 'ladder' ? 20 : p.dir * 22), py - 24, 340, '#ffc46b', 0.5]);
    g.restore();

    // 어둠을 깔고 빛이 닿는 곳만 걷어낸다
    const dg = this.dg, hole = glow('#ffffff');
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W / 2, H / 2);
    dg.fillStyle = `rgba(6,8,30,${z.darkA})`;
    dg.fillRect(0, 0, W / 2, H / 2);
    dg.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of L) dg.drawImage(hole, (x - r) / 2, (y - cam - r) / 2, r, r);
    g.drawImage(this.dark, 0, 0, W, H);

    g.globalCompositeOperation = 'lighter';
    if (!this.low) {
      for (const [x, y, r, c, i] of L) {
        g.globalAlpha = i;
        const q = r * 0.55;
        g.drawImage(glow(c), x - q, y - cam - q, q * 2, q * 2);
      }
      for (const f of this.flies) {
        g.globalAlpha = 0.35 + Math.sin(t * 2 * f.s + f.a) * 0.3;
        const fx = ((f.x % W) + W) % W, fy = f.y - cam;
        if (fy > -20 && fy < H + 20) g.drawImage(glow('#e8ff9a'), fx - 14, fy - 14, 28, 28);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const q of this.parts) {
      const k = 1 - q.life / q.max;
      g.globalAlpha = Math.min(1, k * 1.6);
      if (q.text) {
        g.font = `900 ${q.size}px ${FONT}`;
        g.lineWidth = 6;
        g.strokeStyle = 'rgba(20,16,50,.85)';
        g.strokeText(q.text, q.x, q.y - cam);
        g.fillStyle = q.color;
        g.fillText(q.text, q.x, q.y - cam);
      } else {
        g.globalCompositeOperation = q.add ? 'lighter' : 'source-over';
        const len = Math.abs(q.vx) > 900 ? 40 : 0;
        D.ell(g, q.x, q.y - cam, q.size * k + len, q.size * k, q.color);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** 터치 조작 버튼 */
  controls(input: Input) {
    const g = this.g, s = input.stick;
    // 여백에서 시작한 터치도 스틱은 화면 안에 보이게 한다
    const cx = s ? Math.max(135, Math.min(W / 2, s.cx)) : STICK_HOME.x;
    const cy = s ? Math.max(135, Math.min(H - 135, s.cy)) : STICK_HOME.y;
    let kx = s ? s.x - s.cx : 0, ky = s ? s.y - s.cy : 0;
    const d = Math.hypot(kx, ky);
    if (d > 110) { kx *= 110 / d; ky *= 110 / d; }
    const ring = (x: number, y: number, r: number, fill: string) => {
      D.ell(g, x, y, r, r, fill);
      g.strokeStyle = 'rgba(255,255,255,.4)';
      g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    };
    ring(cx, cy, 130, 'rgba(12,14,44,.3)');
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.font = `800 30px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('▲', cx, cy - 92); g.fillText('▼', cx, cy + 92); g.fillText('◀', cx - 92, cy); g.fillText('▶', cx + 92, cy);
    ring(cx + kx, cy + ky, 54, s ? 'rgba(255,212,120,.6)' : 'rgba(255,255,255,.2)');
    const j = JUMP_BTN;
    ring(j.x, j.y, j.r, input.jumpTouch !== null ? 'rgba(255,212,120,.6)' : 'rgba(255,255,255,.14)');
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.font = `900 40px ${FONT}`;
    g.fillText('점프', j.x, j.y);
    const p = PAUSE_BTN;
    ring(p.x, p.y, p.r, 'rgba(12,14,44,.62)');
    D.rr(g, p.x - 14, p.y - 16, 9, 32, 3, '#fff');
    D.rr(g, p.x + 5, p.y - 16, 9, 32, 3, '#fff');
  }

  hud(w: World, run: Run, hi: number, t: number, timeAttack?: number) {
    const g = this.g, st = w.st;
    const txt = (s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', weight = 800) => {
      g.font = `${weight} ${size}px ${FONT}`;
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(s, x, y);
    };
    const panel = (x: number, wd: number) => D.rr(g, x, 22, wd, 88, 22, 'rgba(12,14,44,.62)');

    panel(30, 350);
    if (timeAttack !== undefined) {
      txt('타임어택', 56, 47, 22, '#b9b6e0', 'left', 700);
      txt(fmtTime(timeAttack), 56, 82, 40, '#ffd84a');
      if (w.deaths) txt(`실수 ${w.deaths} (+${w.deaths * 5}초)`, 358, 47, 20, '#ff8a7a', 'right', 600);
    } else {
      txt('점수', 56, 47, 22, '#b9b6e0', 'left', 700);
      txt(String(run.score).padStart(6, '0'), 56, 82, 40);
      txt(`최고 ${Math.max(hi, run.score)}`, 358, 47, 20, '#8f8cc0', 'right', 600);
    }

    panel(650, 620);
    const ratio = st.bonus ? w.timeLeft / st.time : Math.max(0, w.timeLeft / st.time), low = ratio < 0.2;
    D.ell(g, 700, 66, 24, 24, low ? '#ffb47a' : '#fff3c8');
    D.ell(g, 708, 60, 20, 20, 'rgba(12,14,44,.62)');
    D.rr(g, 744, 55, 420, 22, 11, 'rgba(255,255,255,.13)');
    if (ratio > 0.01) D.rr(g, 744, 55, 420 * ratio, 22, 11, low ? (Math.sin(t * 12) > 0 ? '#ff6a5a' : '#ffa08a') : '#ffe9a8');
    txt(String(Math.ceil(w.timeLeft)), 1246, 67, 38, low ? '#ff8a7a' : '#fff', 'right');

    panel(1540, 350);
    D.fruit(g, 1580, 68, 0, false, 0);
    txt(`×${w.fruitsLeft}`, 1604, 68, 34);
    txt(st.label, 1870, 44, 22, '#b9b6e0', 'right', 700);
    if (timeAttack === undefined) for (let i = 0; i < Math.min(run.lives, 5); i++) D.head(g, 1856 - i * 36, 82, 0.6);

    if (w.combo >= 2) {
      const m = Math.min(8, w.combo), pop = 1 + Math.max(0, w.comboT - 1.8) * 2;
      g.font = `900 ${Math.round(70 * pop)}px ${FONT}`;
      g.textAlign = 'center';
      g.lineWidth = 8;
      g.strokeStyle = 'rgba(20,16,50,.8)';
      g.strokeText(`×${m}`, 960, 170);
      g.fillStyle = m >= 8 ? '#ff8a7a' : '#ffd84a';
      g.fillText(`×${m}`, 960, 170);
      txt('연속 수확', 960, 222, 22, '#fff', 'center', 700);
      D.rr(g, 880, 240, 160 * Math.max(0, w.comboT / 2), 6, 3, '#ffd84a');
    }
    if (st.wind && (w.windWarn || w.windF > 0)) {
      g.globalAlpha = w.windWarn ? 0.5 + Math.sin(t * 16) * 0.4 : 1;
      txt(w.windDir > 0 ? '돌풍 ▶▶▶' : '◀◀◀ 돌풍', 960, 290, 38, '#d8f0ff', 'center');
      g.globalAlpha = 1;
    }
    if (st.bonus) txt('보너스! 열매를 마음껏 모으세요', 960, 150, 34, '#ffd84a', 'center');
  }
}
