import type { ScoreEntry } from './scores';

export interface Best { score: number; rank: string; gold: boolean }
export type Bindable = 'left' | 'right' | 'up' | 'down' | 'jump';
export type KeyMap = Record<Bindable, string>;

export const DEFAULT_KEYS: KeyMap = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Space' };

export interface Save {
  best: Record<number, Best>;
  ta: Record<number, number>; // 타임어택 최고 기록(초)
  unlocked: number; // 선택 가능한 마지막 스테이지 번호
  hi: number;
  scores: ScoreEntry[]; // 점수판 TOP 10
  lastName: string;
  sfx: number;
  music: number;
  shake: boolean;
  colorSafe: boolean;
  keys: KeyMap;
}

const KEY = 'lumi-orchard-v1';
const fresh = (): Save => ({
  best: {}, ta: {}, unlocked: 0, hi: 0, scores: [], lastName: '', sfx: 0.7, music: 0.5, shake: true, colorSafe: false, keys: { ...DEFAULT_KEYS },
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isScore = (e: unknown) => isObj(e) && typeof e.name === 'string' && typeof e.score === 'number'
  && typeof e.stage === 'string' && typeof e.date === 'string';

/** 저장 문자열을 읽는다. 망가진 항목은 기본값으로 대체해 게임이 멈추지 않게 한다 */
export function parseSave(raw: string): Save {
  const f = fresh(), d: unknown = JSON.parse(raw);
  if (!isObj(d)) return f;
  const keys = { ...f.keys };
  if (isObj(d.keys)) for (const k of Object.keys(keys) as Bindable[]) if (typeof d.keys[k] === 'string') keys[k] = d.keys[k] as string;
  return {
    best: isObj(d.best) ? (d.best as unknown as Save['best']) : f.best,
    ta: isObj(d.ta) ? (d.ta as unknown as Save['ta']) : f.ta,
    unlocked: num(d.unlocked, f.unlocked),
    hi: num(d.hi, f.hi),
    scores: Array.isArray(d.scores) ? (d.scores.filter(isScore) as ScoreEntry[]) : f.scores,
    lastName: typeof d.lastName === 'string' ? d.lastName : f.lastName,
    sfx: num(d.sfx, f.sfx),
    music: num(d.music, f.music),
    shake: typeof d.shake === 'boolean' ? d.shake : f.shake,
    colorSafe: typeof d.colorSafe === 'boolean' ? d.colorSafe : f.colorSafe,
    keys,
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseSave(raw);
  } catch { /* 저장소를 쓸 수 없거나 내용이 깨졌으면 기본값으로 진행 */ }
  return fresh();
}

export function storeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 무시 */ }
}
