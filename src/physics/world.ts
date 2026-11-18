import { COLS, T, W } from '../core/const';
import type { Ladder, Stage } from '../stages/types';

export interface Ctl { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; jumpPressed: boolean }
export interface Run { lives: number; score: number; nextLife: number; loop: number }
export type Fx = (type: string, x: number, y: number, arg?: number | string) => void;
export type PState = 'ground' | 'air' | 'ladder' | 'dead' | 'cheer';

export interface Mover { x: number; px: number; y: number; w: number; x0: number; x1: number; speed: number; dir: number }
export interface Hog { x: number; px: number; y: number; x0: number; min: number; max: number; speed: number; dir: number }
export interface Bat { x: number; y: number; px: number; py: number; cx: number; cy: number; rx: number; ry: number; sp: number; ph: number }
export interface Owl { x: number; px: number; y: number; home: number; lo: number; hi: number; dir: number; state: 'idle' | 'alert' | 'dash' | 'back' | 'rest'; st: number }
export interface Wisp { x: number; y: number; px: number; py: number; life: number }

export const GRAVITY = 2600;
export const JUMP = 661; // 최고 높이 약 84px
export const RUN = 330;
const ACC = 4200; // 0.08초 만에 최고 속도
const COYOTE = 0.1, BUFFER = 0.1;
const col = (x: number) => Math.floor(x / T);

/** 덩굴이 흔들리는 폭. 그림과 물리가 같은 값을 쓴다 */
export const vineSway = (y: number, top: number, t: number) =>
  Math.sin(y * 0.05 + t * 1.5) * 9 * Math.min(1, Math.max(0, y - top + 20) / 80);

export class World {
  t = 0;
  clock = 0; // 실제로 움직인 시간 (타임어택 기록)
  timeLeft: number;
  status: 'play' | 'lost' | 'clear' = 'play';
  combo = 0;
  comboT = 0;
  maxCombo = 0;
  deaths = 0;
  gold = false;
  stageScore = 0;
  fruitsLeft: number;
  fruitsTotal: number;
  windF = 0;
  windDir = 1;
  windWarn = false;
  crumbleT: Float32Array;
  private crumbleIdx: number[] = [];
  movers: Mover[];
  hogs: Hog[];
  bats: Bat[];
  owls: Owl[];
  wisps: Wisp[] = [];
  p = {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dir: 1, state: 'ground' as PState, stT: 0,
    coyote: 0, buffer: 0, ladder: null as Ladder | null, dropRow: -1, dropT: 0, noGrab: 0,
    fallTop: 0, mover: null as Mover | null, squash: 0, run: 0, climb: 0, invuln: 0,
  };

  constructor(public st: Stage, public run: Run, public fx: Fx) {
    this.timeLeft = st.time;
    this.fruitsTotal = this.fruitsLeft = st.fruits.filter((f) => !f.gold).length;
    this.crumbleT = new Float32Array(st.tiles.length);
    st.tiles.forEach((v, i) => { if (v === 2) this.crumbleIdx.push(i); });
    this.movers = st.movers.map((m) => ({ ...m, x: m.x0, px: m.x0, dir: 1 }));
    this.hogs = st.hogs.map((h) => ({ ...h, px: h.x, x0: h.x, dir: 1 }));
    this.bats = st.bats.map((b) => ({ ...b, x: b.cx, y: b.cy, px: b.cx, py: b.cy }));
    this.owls = st.owls.map((o) => ({ ...o, px: o.x, home: o.x, dir: o.x < W / 2 ? 1 : -1, state: 'idle', st: 0 }));
    this.place();
  }

  private place() {
    const p = this.p;
    p.x = p.px = this.st.start.x;
    p.y = p.py = this.st.start.y;
    p.vx = p.vy = 0;
    p.dir = 1;
    p.state = 'ground';
    p.stT = 0;
    p.ladder = null;
    p.mover = null;
    p.squash = 0;
    p.buffer = p.coyote = 0;
  }

  /** 목숨을 잃은 뒤 같은 스테이지에서 다시 시작. 모은 열매는 유지된다 */
  respawn() {
    this.place();
    this.p.invuln = 1.6;
    this.timeLeft = this.st.time;
    this.status = 'play';
    this.combo = 0;
    this.comboT = 0;
    this.wisps = [];
    this.crumbleT.fill(0);
    for (const h of this.hogs) { h.x = h.px = h.x0; h.dir = 1; }
    for (const o of this.owls) { o.x = o.px = o.home; o.state = 'idle'; o.st = 0; }
  }

  cloudOn(i: number) { return (this.t + this.st.phase[i]) % 4.2 < 2.8; }

  solid(c: number, r: number): boolean {
    if (c < 0 || c >= COLS || r < 0 || r >= this.st.rows) return false;
    const i = r * COLS + c, v = this.st.tiles[i];
    if (v === 0) return false;
    if (v === 2) return this.crumbleT[i] < 0.5;
    if (v === 3) return this.cloudOn(i);
    return true;
  }

  add(n: number) {
    this.stageScore += n;
    this.run.score += n;
    while (this.run.score >= this.run.nextLife) {
      this.run.lives++;
      this.run.nextLife += 20000;
      this.fx('life', this.p.x, this.p.y - 100);
    }
  }

  update(dt: number, c: Ctl) {
    const p = this.p, st = this.st;
    this.t += dt;
    p.px = p.x; p.py = p.y;
    p.stT += dt;
    p.squash *= Math.max(0, 1 - dt * 10);

    for (const m of this.movers) {
      m.px = m.x;
      m.x += m.dir * m.speed * dt;
      if (m.x > m.x1) { m.x = m.x1; m.dir = -1; }
      if (m.x < m.x0) { m.x = m.x0; m.dir = 1; }
    }
    for (const i of this.crumbleIdx) {
      if (this.crumbleT[i] > 0) { this.crumbleT[i] += dt; if (this.crumbleT[i] > 4.5) this.crumbleT[i] = 0; }
    }
    if (st.wind) {
      const ph = this.t % 7;
      this.windDir = Math.floor(this.t / 7) % 2 ? 1 : -1;
      this.windWarn = ph >= 3 && ph < 4;
      this.windF = ph >= 4 && ph < 6.5 ? Math.min(1, (ph - 4) * 3, (6.5 - ph) * 3) : 0;
    }
    this.enemies(dt);

    if (p.state === 'dead') {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.stT > 1.5) this.status = 'lost';
      return;
    }
    if (p.state === 'cheer') {
      if (p.stT > 1.8) this.status = 'clear';
      return;
    }

    this.clock += dt;
    const before = Math.ceil(this.timeLeft);
    this.timeLeft -= dt;
    if (!st.bonus && this.timeLeft < 10 && Math.ceil(this.timeLeft) < before) this.fx('tick', p.x, p.y);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (p.invuln > 0) p.invuln -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (st.bonus) this.win(); else this.die();
      return;
    }

    this.movePlayer(dt, c);
    this.collect();
    if ((p.state as PState) !== 'cheer') this.hazards();
  }

  private movePlayer(dt: number, c: Ctl) {
    const p = this.p, st = this.st;
    const ax = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (c.jumpPressed) p.buffer = BUFFER; else if (p.buffer > 0) p.buffer -= dt;
    if (p.dropT > 0) p.dropT -= dt;
    if (p.noGrab > 0) p.noGrab -= dt;

    if (p.state === 'ladder') {
      const l = p.ladder!;
      // 사다리 중앙으로 자동 보정. 덩굴이면 흔들림을 따라간다
      const lx = st.zone === 2 ? l.x + vineSway(p.y, l.top, this.t) : l.x;
      p.x += (lx - p.x) * Math.min(1, dt * 18);
      const dy = ((c.down ? 1 : 0) - (c.up ? 1 : 0)) * 230;
      p.y += dy * dt;
      p.climb += Math.abs(dy) * dt;
      p.vx = p.vy = 0;
      if (p.y <= l.top) { p.y = l.top; p.state = 'ground'; }
      else if (p.y >= l.bottom) { p.y = l.bottom; p.state = 'ground'; }
      else if (p.buffer > 0) {
        p.buffer = 0;
        p.state = 'air';
        p.vy = -380;
        p.vx = ax * 260;
        p.fallTop = p.y;
        p.noGrab = 0.3;
        if (ax) p.dir = ax;
      }
      return;
    }

    if (ax) p.dir = ax;
    const grounded = p.state === 'ground';
    const acc = (grounded ? ACC : ACC * 0.75) * dt;
    p.vx += Math.max(-acc, Math.min(acc, ax * RUN - p.vx));

    // 외부 힘: 움직이는 발판, 물줄기, 돌풍
    let ext = this.windDir * this.windF * (grounded ? 70 : 190);
    if (grounded) {
      if (p.mover) ext += (p.mover.x - p.mover.px) / dt;
      const row = Math.round(p.y / T);
      for (const s of st.streams) if (s.row === row && p.x >= s.c0 * T && p.x <= (s.c1 + 1) * T) ext += s.dir * 150;
    }

    // 사다리 잡기
    if ((c.up || c.down) && p.noGrab <= 0) {
      for (const l of st.ladders) {
        if (Math.abs(p.x - l.x) >= 26) continue;
        if (c.up && p.y > l.top + 2 && p.y <= l.bottom + 2) { p.state = 'ladder'; p.ladder = l; p.mover = null; return; }
        if (c.down && grounded && p.buffer <= 0 && Math.abs(p.y - l.top) < 3) {
          p.state = 'ladder'; p.ladder = l; p.y += 3; p.mover = null;
          return;
        }
      }
    }

    // 점프 (입력 버퍼 + 코요테 타임), 아래+점프는 발판 통과
    if (p.buffer > 0 && (grounded || p.coyote > 0)) {
      p.buffer = 0;
      const row = Math.round(p.y / T);
      if (c.down && grounded && row < st.rows - 1 && !p.mover) {
        p.dropRow = row; p.dropT = 0.25; p.y += 1; p.vy = 0;
      } else {
        p.vy = -JUMP;
        p.squash = -0.35;
        this.fx('jump', p.x, p.y);
      }
      p.state = 'air';
      p.coyote = 0;
      p.fallTop = p.y;
      p.mover = null;
    }
    // 가변 점프: 버튼을 떼면 상승을 끊는다
    if (p.state === 'air' && !c.jump && p.vy < -240) p.vy = -240;

    p.x = Math.max(18, Math.min(W - 18, p.x + (p.vx + ext) * dt));

    if (p.state === 'ground') {
      if (!this.support()) {
        p.state = 'air'; p.coyote = COYOTE; p.vy = 0; p.fallTop = p.y;
      } else {
        p.run += Math.abs(p.vx) * dt;
        const row = Math.round(p.y / T);
        for (const dx of [-12, 12]) {
          const i = row * COLS + col(p.x + dx);
          if (st.tiles[i] === 2 && this.crumbleT[i] === 0) { this.crumbleT[i] = 0.001; this.fx('crumble', p.x + dx, p.y); }
        }
      }
      return;
    }

    p.coyote -= dt;
    p.vy = Math.min(p.vy + GRAVITY * dt, 1150);
    const prev = p.y;
    p.y += p.vy * dt;
    if (p.y < p.fallTop) p.fallTop = p.y;
    if (p.vy < 0) return;

    // 착지. 발판 윗면보다 10px까지 낮아도 올려 준다(모서리 보정)
    const row = Math.floor(p.y / T), surf = row * T;
    if (prev <= surf + 10 && !(p.dropT > 0 && row === p.dropRow) &&
        (this.solid(col(p.x - 12), row) || this.solid(col(p.x + 12), row))) {
      this.land(surf);
      return;
    }
    for (const m of this.movers) {
      if (prev <= m.y + 10 && p.y >= m.y && p.x > m.x - 12 && p.x < m.x + m.w + 12) {
        this.land(m.y);
        p.mover = m;
        return;
      }
    }
  }

  private support(): boolean {
    const p = this.p, row = Math.round(p.y / T);
    if (this.solid(col(p.x - 12), row) || this.solid(col(p.x + 12), row)) { p.mover = null; return true; }
    for (const m of this.movers) {
      if (Math.abs(p.y - m.y) < 3 && p.x > m.x - 12 && p.x < m.x + m.w + 12) { p.mover = m; p.y = m.y; return true; }
    }
    p.mover = null;
    return false;
  }

  private land(surf: number) {
    const p = this.p, fall = surf - p.fallTop;
    p.y = surf;
    p.vy = 0;
    p.state = 'ground';
    p.squash = 0.4;
    this.fx('land', p.x, p.y);
    if (fall >= 5 * T - 2) this.die(); // 두 층 이상 떨어지면 목숨을 잃는다
  }

  private collect() {
    const p = this.p;
    for (const f of this.st.fruits) {
      if (f.got || Math.abs(f.x - p.x) >= 36 || f.y <= p.y - 90 || f.y >= p.y + 8) continue;
      f.got = true;
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = 2;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = (f.gold ? 1000 : 100) * Math.min(8, this.combo);
      this.add(pts);
      this.fx(f.gold ? 'gold' : 'pick', f.x, f.y, this.combo);
      this.fx('text', f.x, f.y - 34, String(pts));
      if (f.gold) this.gold = true;
      else if (--this.fruitsLeft === 0) { this.win(); return; }
    }
    for (const b of this.st.boxes) {
      if (b.open || Math.abs(b.x - p.x) >= 38 || Math.abs(b.y - p.y) >= 40) continue;
      b.open = true;
      if (b.content === 'bonus') { this.add(500); this.fx('bonus', b.x, b.y - 30); this.fx('text', b.x, b.y - 70, '500'); }
      else if (b.content === 'time') {
        this.timeLeft = Math.min(this.st.time, this.timeLeft + 10);
        this.fx('time', b.x, b.y - 30);
        this.fx('text', b.x, b.y - 70, '+10초');
      } else {
        this.wisps.push({ x: b.x, y: b.y - 44, px: b.x, py: b.y - 44, life: 3.4 });
        this.fx('wisp', b.x, b.y - 30);
      }
    }
  }

  private hazards() {
    const p = this.p;
    if (p.invuln > 0) return;
    const hit = (x0: number, x1: number, y0: number, y1: number) =>
      p.x + 13 > x0 && p.x - 13 < x1 && p.y - 4 > y0 && p.y - 70 < y1;
    for (const b of this.st.burrs) if (hit(b.x - 15, b.x + 15, b.y - 28, b.y)) return this.die();
    for (const h of this.hogs) if (hit(h.x - 20, h.x + 20, h.y - 32, h.y)) return this.die();
    for (const b of this.bats) if (hit(b.x - 18, b.x + 18, b.y - 12, b.y + 12)) return this.die();
    for (const o of this.owls) if (hit(o.x - 22, o.x + 22, o.y - 52, o.y - 4)) return this.die();
    for (const w of this.wisps) if (w.life < 3 && w.life > 0.3 && hit(w.x - 15, w.x + 15, w.y - 15, w.y + 15)) return this.die();
  }

  private die() {
    const p = this.p;
    if (p.state === 'dead') return;
    p.state = 'dead';
    p.stT = 0;
    p.vy = -560;
    p.mover = null;
    this.deaths++;
    this.combo = 0;
    this.comboT = 0;
    this.fx('die', p.x, p.y - 40);
  }

  private win() {
    const p = this.p;
    p.state = 'cheer';
    p.stT = 0;
    p.vx = 0;
    this.fx('clear', p.x, p.y - 60);
  }

  private enemies(dt: number) {
    const p = this.p, alive = p.state !== 'dead' && p.state !== 'cheer';
    for (const h of this.hogs) {
      h.px = h.x;
      h.x += h.dir * h.speed * dt;
      if (h.x > h.max) { h.x = h.max; h.dir = -1; }
      if (h.x < h.min) { h.x = h.min; h.dir = 1; }
    }
    for (const b of this.bats) {
      b.px = b.x; b.py = b.y;
      const a = this.t * b.sp + b.ph;
      b.x = b.cx + Math.cos(a) * b.rx;
      b.y = b.cy + Math.sin(a * 2) * b.ry;
    }
    for (const o of this.owls) {
      o.px = o.x;
      o.st += dt;
      if (o.state === 'idle') {
        // 같은 층에 서 있으면 노려본 뒤 돌진한다
        if (alive && p.state !== 'ladder' && Math.abs(p.y - o.y) < 20) { o.state = 'alert'; o.st = 0; this.fx('owl', o.x, o.y - 40); }
      } else if (o.state === 'alert') {
        o.dir = p.x >= o.x ? 1 : -1;
        if (o.st > 0.7) { o.state = 'dash'; o.st = 0; }
      } else if (o.state === 'dash') {
        o.x += o.dir * 640 * dt;
        if (o.x <= o.lo || o.x >= o.hi || o.st > 1.6) { o.x = Math.max(o.lo, Math.min(o.hi, o.x)); o.state = 'back'; o.st = 0; }
      } else if (o.state === 'back') {
        const d = o.home - o.x;
        o.dir = d >= 0 ? 1 : -1;
        if (Math.abs(d) < 200 * dt) { o.x = o.home; o.state = 'rest'; o.st = 0; o.dir = o.home < W / 2 ? 1 : -1; }
        else o.x += o.dir * 200 * dt;
      } else if (o.st > 1) o.state = 'idle';
    }
    for (const w of this.wisps) {
      w.px = w.x; w.py = w.y;
      w.life -= dt;
      if (!alive || w.life > 3) continue;
      const dx = p.x - w.x, dy = p.y - 38 - w.y, d = Math.hypot(dx, dy) || 1;
      w.x += (dx / d) * 115 * dt;
      w.y += (dy / d) * 115 * dt;
    }
    this.wisps = this.wisps.filter((w) => w.life > 0);
  }
}
