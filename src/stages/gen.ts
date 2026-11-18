import { COLS, T, rng } from '../core/const';
import type { Box, Def, Fruit, Ladder, Stage } from './types';

/**
 * 시드로 스테이지를 만든다. 같은 시드는 항상 같은 스테이지가 된다.
 * 규칙으로 클리어 가능성을 보장한다:
 *  - 모든 층은 아래층과 사다리로 이어진다
 *  - 구멍은 점프로 건널 수 있는 폭(2칸)이고, 넓은 틈에는 움직이는 발판이 있다
 *  - 밤송이는 구멍·사다리·다른 밤송이와 떨어져 있어 착지할 자리가 있다
 */
export function generate(def: Def, id: number, loop = 0): Stage {
  const r = rng(def.seed * 7919 + 13);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const shuffle = <X>(a: X[]) => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const rows = def.tall ? 30 : 18;
  const tiles = new Uint8Array(COLS * rows), phase = new Float32Array(COLS * rows);
  const floors: number[] = [];
  for (let y = rows - 1; y >= 5; y -= 3) floors.push(y);
  const n = floors.length;
  const span: [number, number][] = [];
  const blocked = floors.map(() => new Uint8Array(COLS));
  const at = (i: number, c: number) => (i < 0 || i >= n || c < 0 || c >= COLS ? 0 : tiles[floors[i] * COLS + c]);
  const set = (i: number, c: number, v: number) => { tiles[floors[i] * COLS + c] = v; };
  const block = (i: number, a: number, b: number) => {
    for (let c = Math.max(0, a); c <= Math.min(COLS - 1, b); c++) blocked[i][c] = 1;
  };

  floors.forEach((_, i) => {
    let a = 0, b = COLS - 1;
    if (i > 0 && r() < def.trim) { if (r() < 0.5) a = ri(2, 5); else b = COLS - 1 - ri(2, 5); }
    span.push([a, b]);
    for (let c = a; c <= b; c++) set(i, c, 1);
  });
  block(0, 0, 6); // 시작 지점 주변은 비워 둔다

  // 구멍
  const gaps: [number, number][][] = floors.map(() => []);
  const carve = (i: number, w: number, pitOk: boolean) => {
    const [a, b] = span[i];
    for (let k = 0; k < 60; k++) {
      const c = ri(a + 4, b - 3 - w);
      if (gaps[i].some(([g, gw]) => c < g + gw + 5 && c + w + 5 > g)) continue;
      let pit = gaps[i + 1]?.some(([g, gw]) => c < g + gw && c + w > g) ?? false;
      for (let x = c; x < c + w; x++) if (!at(i - 1, x)) pit = true;
      if (pit && !pitOk) continue;
      for (let x = c; x < c + w; x++) set(i, x, 0);
      gaps[i].push([c, w]);
      block(i, c - 3, c + w + 2);
      return c;
    }
    return -1;
  };

  const upper = shuffle(floors.map((_, i) => i).slice(1));
  const movers: Stage['movers'] = [];
  for (let k = 0; k < def.movers; k++) {
    const i = upper[k % upper.length];
    const c = carve(i, 6, false);
    if (c >= 0) movers.push({ x0: c * T, x1: (c + 6) * T - 120, y: floors[i] * T, w: 120, speed: 105 + r() * 40 });
  }
  for (let i = 1; i < n; i++) for (let k = 0; k < def.gaps; k++) carve(i, 2, r() < def.pit);

  // 사다리
  const ladders: Ladder[] = [];
  let prev: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const ok = (c: number, strict: boolean) =>
      at(i, c) === 1 && at(i + 1, c) === 1 &&
      (!strict || (at(i, c - 1) && at(i, c + 1) && at(i + 1, c - 1) && at(i + 1, c + 1)));
    let cand: number[] = [];
    for (let c = 1; c < COLS - 1; c++) if (ok(c, true)) cand.push(c);
    if (!cand.length) for (let c = 0; c < COLS; c++) if (ok(c, false)) cand.push(c);
    shuffle(cand);
    const picked: number[] = [];
    for (const far of [3, 0]) {
      for (const c of cand) {
        if (picked.length >= def.ladders) break;
        if (picked.some((p) => Math.abs(p - c) < 6) || prev.some((p) => Math.abs(p - c) < far)) continue;
        picked.push(c);
      }
    }
    if (!picked.length) {
      const c = Math.max(span[i][0], span[i + 1][0]) + 2;
      set(i, c, 1); set(i + 1, c, 1);
      picked.push(c);
    }
    for (const c of picked) {
      ladders.push({ x: c * T + 30, top: floors[i + 1] * T, bottom: floors[i] * T });
      block(i, c - 1, c + 1); block(i + 1, c - 1, c + 1);
    }
    prev = picked;
  }

  // 물줄기
  const streams: Stage['streams'] = [];
  for (let k = 0; k < def.streams; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const i = ri(0, n - 1), c = ri(i ? span[i][0] : 8, span[i][1] - 4);
      let good = true;
      for (let x = c; x <= c + 4; x++) if (at(i, x) !== 1 || streams.some((s) => s.row === floors[i] && x >= s.c0 - 1 && x <= s.c1 + 1)) good = false;
      if (!good) continue;
      streams.push({ row: floors[i], c0: c, c1: c + 4, dir: r() < 0.5 ? -1 : 1 });
      block(i, c, c + 4);
      break;
    }
  }

  // 부서지는 발판(2), 사라지는 구름(3)
  const special = (v: number, count: number) => {
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 60; tries++) {
        const i = ri(1, n - 1), c = ri(span[i][0] + 1, span[i][1] - 2);
        if (at(i, c - 1) !== 1 || at(i, c) !== 1 || at(i, c + 1) !== 1 || at(i, c + 2) !== 1) continue;
        if (blocked[i][c] || blocked[i][c + 1]) continue;
        const ph = r() * 4.2;
        for (const x of [c, c + 1]) { set(i, x, v); phase[floors[i] * COLS + x] = ph; }
        block(i, c - 1, c + 2);
        break;
      }
    }
  };
  special(2, def.crumbles);
  special(3, def.clouds);

  // 올빼미: 층의 한쪽 끝에 앉아 있다
  const owls: Stage['owls'] = [];
  const owlFloors = shuffle(floors.map((_, i) => i).slice(1));
  for (let k = 0; k < Math.min(def.owls, owlFloors.length); k++) {
    const i = owlFloors[k], c = r() < 0.5 ? span[i][0] : span[i][1];
    if (at(i, c) !== 1 || blocked[i][c]) continue;
    owls.push({ x: c * T + 30, y: floors[i] * T, lo: span[i][0] * T + 30, hi: span[i][1] * T + 30 });
    block(i, c - 2, c + 2);
  }

  // 밤송이
  const burrs: Stage['burrs'] = [];
  const burrCols = floors.map(() => new Set<number>());
  for (let k = 0; k < def.burrs; k++) {
    for (let tries = 0; tries < 60; tries++) {
      const i = ri(0, n - 1), c = ri(span[i][0] + 2, span[i][1] - 2);
      if (at(i, c) !== 1 || blocked[i][c] || blocked[i][c - 1] || blocked[i][c + 1]) continue;
      burrs.push({ x: c * T + 30, y: floors[i] * T, i });
      burrCols[i].add(c);
      block(i, c - 2, c + 2);
      break;
    }
  }

  // 고슴도치: 밤송이·구멍이 없는 구간을 왕복한다
  const hogs: Stage['hogs'] = [];
  const used = floors.map(() => new Uint8Array(COLS));
  const free = (i: number, c: number) =>
    at(i, c) === 1 && !burrCols[i].has(c) && !used[i][c] && (i > 0 || c >= 9);
  for (let k = 0; k < def.hogs; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const i = ri(0, n - 1), c = ri(span[i][0], span[i][1]);
      if (!free(i, c)) continue;
      let a = c, b = c;
      while (free(i, a - 1) && c - a < 5) a--;
      while (free(i, b + 1) && b - c < 5) b++;
      if (b - a < 4) continue;
      for (let x = a - 1; x <= b + 1; x++) if (x >= 0 && x < COLS) used[i][x] = 1;
      hogs.push({
        x: c * T + 30, y: floors[i] * T, min: a * T + 24, max: (b + 1) * T - 24,
        speed: (70 + def.zone * 8 + r() * 40) * (1 + loop * 0.15),
      });
      break;
    }
  }

  // 등불 상자
  const boxes: Box[] = [];
  const boxCols = floors.map(() => new Set<number>());
  for (let k = 0; k < def.boxes; k++) {
    for (let tries = 0; tries < 60; tries++) {
      const i = ri(0, n - 1), c = ri(span[i][0] + 1, span[i][1] - 1);
      if (at(i, c) !== 1 || blocked[i][c]) continue;
      const v = r();
      const content = v < 0.45 ? 'bonus' : v < 0.7 || def.bonus ? 'time' : 'wisp';
      boxes.push({ x: c * T + 30, y: floors[i] * T, content, open: false });
      boxCols[i].add(c);
      block(i, c - 1, c + 1);
      break;
    }
  }

  // 열매
  const fruits: Fruit[] = [];
  const fruitCols = floors.map(() => new Set<number>());
  const add = (x: number, y: number, gold = false) => fruits.push({ x, y, kind: ri(0, 3), gold, got: false });
  for (let i = 1; i < n; i++) {
    for (const [g, w] of gaps[i]) if (w === 2 && r() < 0.6 && fruits.length < def.fruits) add((g + 1) * T, floors[i] * T - 72);
  }
  for (let guard = 0, k = 0; fruits.length < def.fruits && guard < 5000; guard++) {
    const i = k % n, c = ri(span[i][0], span[i][1]);
    const fc = fruitCols[i];
    if (!at(i, c) || burrCols[i].has(c) || boxCols[i].has(c) || fc.has(c) || fc.has(c - 1) || fc.has(c + 1) || (i === 0 && c < 4)) continue;
    fc.add(c);
    add(c * T + 30, floors[i] * T - (r() < 0.2 ? 118 : 36));
    k++;
  }

  // 황금 열매: 가장 높은 밤송이 바로 위, 없으면 구멍 위
  if (!def.bonus) {
    const top = [...burrs].sort((a, b) => b.i - a.i)[0];
    let done = false;
    if (top && top.i > 0) { add(top.x, top.y - 124, true); done = true; }
    for (let i = n - 1; i > 0 && !done; i--) {
      const g = gaps[i].find(([, w]) => w === 2);
      if (g) { add((g[0] + 1) * T, floors[i] * T - 130, true); done = true; }
    }
    if (!done) add(16 * T + 30, floors[n - 1] * T - 132, true);
  }

  // 박쥐: 8자 궤도로 층 위를 오르내린다
  const bats: Stage['bats'] = [];
  for (let k = 0; k < def.bats; k++) {
    const i = ri(0, n - 1);
    bats.push({ cx: ri(i ? 320 : 720, 1600), cy: floors[i] * T - 78, rx: ri(150, 250), ry: 56, sp: 1.1 + r() * 0.7, ph: r() * 6.28 });
  }

  const zoneStage = (id % 6) + 1;
  return {
    id, label: def.bonus ? '보너스' : `${def.zone}-${zoneStage}`, zone: def.zone, bonus: !!def.bonus,
    rows, tiles, phase, floors, ladders, fruits, boxes, burrs, hogs, bats, owls, movers, streams,
    wind: !!def.wind, time: Math.round(def.time * (loop ? 0.9 : 1)),
    start: { x: 2 * T + 30, y: floors[0] * T },
  };
}
