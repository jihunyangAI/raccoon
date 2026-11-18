import { describe, expect, it } from 'vitest';
import { JINGLES, TRACKS, freq, jingleSeconds } from '../src/core/audio';
import { COLS, STEP, T } from '../src/core/const';
import { MAX_SCORES, insertScore, rankFor } from '../src/core/scores';
import { World, type Ctl } from '../src/physics/world';
import { BONUS, DEFS } from '../src/stages/defs';
import { generate } from '../src/stages/gen';

const idle: Ctl = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false };
const mkWorld = (i = 0) => new World(generate(DEFS[i], i), { lives: 3, score: 0, nextLife: 20000, loop: 0 }, () => {});
const all = [...DEFS.map((d, i) => [d, i] as const), ...BONUS.map((d, i) => [d, i * 6 + 5] as const)];

describe('스테이지 생성', () => {
  it('24개 스테이지와 4개 보너스가 있다', () => {
    expect(DEFS.length).toBe(24);
    expect(BONUS.length).toBe(4);
  });

  it('같은 시드는 같은 스테이지를 만든다', () => {
    const a = generate(DEFS[7], 7), b = generate(DEFS[7], 7);
    expect([...a.tiles]).toEqual([...b.tiles]);
    expect(a.fruits).toEqual(b.fruits);
    expect(a.ladders).toEqual(b.ladders);
  });

  it.each(all)('스테이지 %#: 모든 층이 사다리로 이어진다', (def, i) => {
    const st = generate(def, i);
    for (let k = 0; k < st.floors.length - 1; k++) {
      const ls = st.ladders.filter((l) => l.bottom === st.floors[k] * T && l.top === st.floors[k + 1] * T);
      expect(ls.length).toBeGreaterThan(0);
      for (const l of ls) {
        const c = Math.floor(l.x / T);
        expect(st.tiles[st.floors[k] * COLS + c]).toBe(1);
        expect(st.tiles[st.floors[k + 1] * COLS + c]).toBe(1);
      }
    }
  });

  it.each(all)('스테이지 %#: 열매 수와 배치가 올바르다', (def, i) => {
    const st = generate(def, i);
    expect(st.fruits.filter((f) => !f.gold).length).toBe(def.fruits);
    expect(st.fruits.filter((f) => f.gold).length).toBe(def.bonus ? 0 : 1);
    // 열매는 발판(또는 구멍) 위 점프로 닿는 높이에 있다
    for (const f of st.fruits) {
      const surface = st.floors.map((r) => r * T).filter((y) => y > f.y).sort((a, b) => a - b)[0];
      expect(surface - f.y).toBeLessThanOrEqual(140);
    }
  });

  it.each(all)('스테이지 %#: 밤송이는 사다리·구멍과 떨어져 있다', (def, i) => {
    const st = generate(def, i);
    for (const b of st.burrs) {
      const c = Math.floor(b.x / T), row = b.y / T;
      for (const l of st.ladders) {
        if (l.top === b.y || l.bottom === b.y) expect(Math.abs(Math.floor(l.x / T) - c)).toBeGreaterThanOrEqual(2);
      }
      for (const d of [-2, -1, 0, 1, 2]) expect(st.tiles[row * COLS + c + d]).not.toBe(0);
    }
  });

  it.each(all)('스테이지 %#: 구멍은 점프로 건널 수 있는 폭이거나 움직이는 발판이 있다', (def, i) => {
    const st = generate(def, i);
    for (const row of st.floors) {
      let first = COLS, last = -1;
      for (let c = 0; c < COLS; c++) if (st.tiles[row * COLS + c]) { first = Math.min(first, c); last = c; }
      for (let c = first, run = 0; c <= last; c++) {
        if (st.tiles[row * COLS + c]) { run = 0; continue; }
        run++;
        if (run > 2) expect(st.movers.some((m) => m.y === row * T && c * T >= m.x0 && c * T <= m.x1 + m.w)).toBe(true);
      }
    }
  });
});

describe('점수판', () => {
  const e = (score: number, name = 'AAA') => ({ name, score, stage: '1-1', date: '2026-11-19' });

  it('높은 점수 순으로 들어가고 같은 점수는 먼저 낸 기록이 위다', () => {
    const r = insertScore([e(500, 'OLD'), e(100)], e(500, 'NEW'));
    expect(r.rank).toBe(1);
    expect(r.list.map((x) => x.name)).toEqual(['OLD', 'NEW', 'AAA']);
  });

  it('10개를 넘으면 꼴찌가 빠지고, 못 미치는 점수와 0점은 들어가지 못한다', () => {
    const full = Array.from({ length: MAX_SCORES }, (_, i) => e((MAX_SCORES - i) * 100));
    expect(rankFor(full, 100)).toBe(-1);
    expect(rankFor([], 0)).toBe(-1);
    const r = insertScore(full, e(150, 'NEW'));
    expect(r.rank).toBe(9);
    expect(r.list).toHaveLength(MAX_SCORES);
    expect(r.list[9].name).toBe('NEW');
  });
});

describe('음악', () => {
  it.each(Object.keys(TRACKS))('%s: 마디 수가 맞고 모든 음을 연주할 수 있다', (name) => {
    const t = TRACKS[name];
    expect(t.mel.length).toBe(t.chords.length * 8);
    for (const n of t.mel) if (n !== '-') expect(freq(n)).toBeGreaterThan(100);
    for (const c of t.chords) expect(freq(c, 2)).toBeGreaterThan(30);
  });

  it('클리어와 엔딩 징글은 짧고, 모든 음이 곡 길이 안에 있다', () => {
    expect(jingleSeconds(JINGLES.win)).toBeLessThan(3.5);
    expect(jingleSeconds(JINGLES.ending)).toBeLessThan(5);
    for (const j of Object.values(JINGLES)) {
      for (const [b, len] of [...j.stabs, ...j.bass]) expect(b + len).toBeLessThanOrEqual(j.beats);
      for (const b of [...j.kick, ...j.clap, ...j.bell, j.crash]) expect(b).toBeLessThan(j.beats);
    }
  });
});

describe('물리', () => {
  it('끝까지 누른 점프는 약 84px 오르고 다시 착지한다', () => {
    const w = mkWorld();
    const y0 = w.p.y;
    let top = y0;
    w.update(STEP, { ...idle, jump: true, jumpPressed: true });
    for (let i = 0; i < 120; i++) { w.update(STEP, { ...idle, jump: true }); top = Math.min(top, w.p.y); }
    expect(y0 - top).toBeGreaterThan(78);
    expect(y0 - top).toBeLessThan(90);
    expect(w.p.state).toBe('ground');
    expect(w.p.y).toBe(y0);
  });

  it('짧게 누르면 낮게 뛴다 (가변 점프)', () => {
    const w = mkWorld();
    const y0 = w.p.y;
    let top = y0;
    w.update(STEP, { ...idle, jump: true, jumpPressed: true });
    for (let i = 0; i < 120; i++) { w.update(STEP, idle); top = Math.min(top, w.p.y); }
    expect(y0 - top).toBeLessThan(40);
  });

  it('0.08초 안에 최고 속도에 도달한다', () => {
    const w = mkWorld();
    for (let i = 0; i < 10; i++) w.update(STEP, { ...idle, right: true });
    expect(w.p.vx).toBeCloseTo(330, 0);
  });

  it('2칸 구멍을 달리며 점프해 건넌다', () => {
    // 점프 한 번의 수평 이동 거리가 2칸(120px)을 넘어야 한다
    const w = mkWorld();
    for (let i = 0; i < 20; i++) w.update(STEP, { ...idle, right: true });
    const x0 = w.p.x;
    w.update(STEP, { ...idle, right: true, jump: true, jumpPressed: true });
    let n = 0;
    while (w.p.state === 'air' && n++ < 200) w.update(STEP, { ...idle, right: true, jump: true });
    expect(w.p.x - x0).toBeGreaterThan(150);
  });

  it('사다리를 올라 위층에 선다', () => {
    const w = mkWorld();
    const l = w.st.ladders.find((x) => x.bottom === w.st.start.y)!;
    w.p.x = w.p.px = l.x;
    for (let i = 0; i < 240 && w.p.y > l.top; i++) w.update(STEP, { ...idle, up: true });
    expect(w.p.y).toBe(l.top);
    expect(w.p.state).toBe('ground');
  });

  it('열매를 연속으로 먹으면 배수가 오른다', () => {
    const w = mkWorld();
    const fs = w.st.fruits.filter((f) => !f.gold).slice(0, 3);
    for (const f of fs) { f.x = w.p.x; f.y = w.p.y - 36; w.update(STEP, idle); f.x = -999; }
    expect(w.combo).toBe(3);
    expect(w.stageScore).toBe(100 + 200 + 300);
  });

  it('시간이 다 되면 목숨을 잃는 상태가 된다', () => {
    const w = mkWorld();
    w.timeLeft = 0.01;
    for (let i = 0; i < 400 && w.status === 'play'; i++) w.update(STEP, idle);
    expect(w.status).toBe('lost');
  });
});
