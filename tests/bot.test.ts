import { describe, expect, it } from 'vitest';
import { COLS, STEP, T } from '../src/core/const';
import { World, type Ctl } from '../src/physics/world';
import { BONUS, DEFS } from '../src/stages/defs';
import { generate } from '../src/stages/gen';
import type { Def, Fruit } from '../src/stages/types';

/**
 * 실제 물리로 스테이지를 끝까지 도는 자동 플레이어.
 * 적을 피하는 판단은 하지 않으므로 무적으로 달린다. 즉 "지형상 모든 열매에 닿을 수 있는가"를 검사한다.
 */
function playStage(def: Def, id: number) {
  const st = generate(def, id);
  const w = new World(st, { lives: 3, score: 0, nextLife: 1e12, loop: 0 }, () => {});
  const ys = st.floors.map((r) => r * T);
  const floorOf = (y: number) => ys.indexOf(Math.round(y / T) * T);
  const fruitFloor = (f: Fruit) => {
    let best = 0, gap = Infinity;
    ys.forEach((y, i) => { if (y > f.y && y - f.y < gap) { gap = y - f.y; best = i; } });
    return best;
  };
  const standable = (x: number, row: number) =>
    w.solid(Math.floor(x / T), row) || w.movers.some((m) => m.y === row * T && x > m.x && x < m.x + m.w);
  let dir = 0, climb = 0, falls = 0, step = 0;
  let target: Fruit | undefined;

  const control = (): Ctl => {
    const p = w.p;
    const c: Ctl = { left: false, right: false, up: false, down: false, jump: true, jumpPressed: false };
    const move = (d: number) => { dir = d; c.left = d < 0; c.right = d > 0; };
    if (p.state === 'dead' || p.state === 'cheer') return c;
    if (p.state === 'ladder') { c.up = climb < 0; c.down = climb > 0; return c; }
    if (p.state === 'air') { move(dir); return c; }

    const left = st.fruits.filter((f) => !f.got);
    const pi = floorOf(p.y), row = st.floors[pi];
    const rank = (f: Fruit) => (f.gold ? -1e6 : 0) + Math.abs(fruitFloor(f) - pi) * 4000 + Math.abs(f.x - p.x);
    // 목표는 먹을 때까지 바꾸지 않는다 (거리가 비슷한 두 열매 사이에서 왔다 갔다 하지 않게)
    if (!target || target.got) target = left.sort((a, b) => rank(a) - rank(b))[0];
    const f = target;
    const fi = fruitFloor(f);
    let tx = f.x;
    if (fi !== pi) {
      const up = fi > pi, a = ys[pi], b = ys[pi + (up ? 1 : -1)];
      const ls = st.ladders.filter((l) => (up ? l.bottom === a && l.top === b : l.top === a && l.bottom === b));
      const l = ls.sort((m, n) => Math.abs(m.x - p.x) - Math.abs(n.x - p.x))[0];
      tx = l.x;
      if (Math.abs(p.x - l.x) < 14) { climb = up ? -1 : 1; c.up = up; c.down = !up; return c; }
    } else if (Math.abs(f.x - p.x) < 12) {
      c.jumpPressed = true;
      dir = 0;
      return c;
    }

    const d = Math.sign(tx - p.x) || 1, probe = p.x + d * 26;
    const burr = st.burrs.some((b) => b.y === p.y && (b.x - p.x) * d > 0 && Math.abs(b.x - p.x) < 62);
    if (burr) { move(d); c.jumpPressed = true; return c; }
    if (standable(probe, row)) { move(d); return c; }
    let width = 0;
    for (let x = Math.floor(probe / T); x >= 0 && x < COLS && !w.solid(x, row) && width < 4; x += d) width++;
    if (width <= 3 && !p.mover) { move(d); c.jumpPressed = true; return c; }
    dir = 0; // 넓은 틈: 움직이는 발판이 올 때까지 기다린다
    return c;
  };

  for (; step < 120 * 900 && w.status !== 'clear'; step++) {
    w.p.invuln = 1e9;
    w.timeLeft = st.time;
    w.update(STEP, control());
    if (w.status === 'lost') { falls++; w.respawn(); }
  }
  return {
    cleared: w.status === 'clear', seconds: step * STEP, falls, limit: st.time,
    gold: st.fruits.filter((f) => f.gold).every((f) => f.got),
    stuck: w.status === 'clear' ? '' : `위치 ${Math.round(w.p.x)},${Math.round(w.p.y)}, 목표 ${target?.x},${target?.y}`,
  };
}

const all = [...DEFS.map((d, i) => [`${d.zone}-${(i % 6) + 1}`, d, i] as const),
  ...BONUS.map((d, i) => [`보너스 ${i + 1}`, d, i * 6 + 5] as const)];

describe('자동 플레이', () => {
  it.each(all)('%s: 모든 열매에 닿아 제한 시간 안에 클리어한다', (name, def, id) => {
    const r = playStage(def, id);
    console.log(`${name}: ${r.cleared ? `${r.seconds.toFixed(1)}초` : '실패'} / 제한 ${r.limit}초, 낙사 ${r.falls}, 황금 ${r.gold} ${r.stuck}`);
    expect(r.cleared).toBe(true);
    if (def.bonus) return; // 보너스는 시간이 끝나면 그냥 종료된다
    expect(r.gold).toBe(true);
    expect(r.seconds * 1.4).toBeLessThan(r.limit); // 사람이 적을 피할 여유를 둔다
  }, 30000);
});
