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

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* 저장소를 쓸 수 없으면 기본값으로 진행 */ }
  return fresh();
}

export function storeSave(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 무시 */ }
}
