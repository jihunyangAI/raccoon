export const W = 1920;
export const H = 1080;
export const T = 60; // 타일 크기
export const COLS = 32;
export const STEP = 1 / 120; // 고정 물리 스텝
export const FONT = `"Pretendard","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif`;

/** 시드 고정 난수 (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
