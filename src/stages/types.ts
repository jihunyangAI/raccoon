/** 스테이지 생성 파라미터 */
export interface Def {
  zone: number;
  seed: number;
  tall?: boolean; // 세로로 긴 스크롤 스테이지
  bonus?: boolean;
  gaps: number; // 층마다 뚫는 구멍 수
  ladders: number; // 층 사이 사다리 수
  burrs: number;
  hogs: number;
  bats: number;
  owls: number;
  boxes: number;
  fruits: number;
  crumbles: number;
  clouds: number;
  movers: number;
  streams: number;
  wind?: boolean;
  pit: number; // 구멍이 아래층 구멍과 겹쳐도 되는 확률(깊은 낭떠러지)
  trim: number; // 층 한쪽 끝을 잘라내는 확률
  time: number;
}

export interface Ladder { x: number; top: number; bottom: number }
export interface Fruit { x: number; y: number; kind: number; gold: boolean; got: boolean }
export interface Box { x: number; y: number; content: 'bonus' | 'time' | 'wisp'; open: boolean }

/** 타일 값: 0 빈칸, 1 발판, 2 부서지는 발판, 3 사라지는 구름 */
export interface Stage {
  id: number;
  label: string;
  zone: number;
  bonus: boolean;
  rows: number;
  tiles: Uint8Array;
  phase: Float32Array;
  floors: number[]; // 아래층부터 행 번호
  ladders: Ladder[];
  fruits: Fruit[];
  boxes: Box[];
  burrs: { x: number; y: number; i: number }[];
  hogs: { x: number; y: number; min: number; max: number; speed: number }[];
  bats: { cx: number; cy: number; rx: number; ry: number; sp: number; ph: number }[];
  owls: { x: number; y: number; lo: number; hi: number }[];
  movers: { x0: number; x1: number; y: number; w: number; speed: number }[];
  streams: { row: number; c0: number; c1: number; dir: number }[];
  wind: boolean;
  time: number;
  start: { x: number; y: number };
}
