import { H, W } from './const';

export interface Circle { x: number; y: number; r: number }
export interface Inset { l: number; r: number; t: number; b: number }
export interface TouchLayout {
  game: { x: number; y: number; w: number; h: number };
  stick: Circle;
  jump: Circle;
  pause: Circle;
}

const NO_INSET: Inset = { l: 0, r: 0, t: 0, b: 0 };

/**
 * 터치 플레이 화면 배치(CSS 픽셀). 조작판이 게임을 가리지 않도록 전용 띠를 떼어 두고,
 * 양옆과 아래 중 게임이 더 크게 보이는 쪽을 고른다.
 */
export function touchLayout(vw: number, vh: number, inset: Inset = NO_INSET): TouchLayout {
  const { l, r, t, b } = inset;
  const band = Math.round(Math.max(104, Math.min(170, Math.min(vw, vh) * 0.34)));
  const size = band * 0.44;
  const fit = (bw: number, bh: number) => Math.max(1, Math.floor(Math.min(bw, (bh * W) / H)));
  const sideW = fit(vw - l - r - band * 2, vh - t - b);
  const belowW = fit(vw - l - r, vh - t - b - band);

  if (sideW >= belowW) {
    const h = Math.floor((sideW * H) / W), y = Math.min(vh - b - size - 12, vh * 0.68);
    const jumpX = vw - r - band / 2;
    return {
      game: { x: Math.round(l + band + (vw - l - r - band * 2 - sideW) / 2), y: Math.round(t + (vh - t - b - h) / 2), w: sideW, h },
      stick: { x: l + band / 2, y, r: size },
      jump: { x: jumpX, y, r: size },
      pause: { x: jumpX, y: t + 36, r: 24 },
    };
  }
  const h = Math.floor((belowW * H) / W), y = vh - b - band / 2;
  return {
    game: { x: Math.round(l + (vw - l - r - belowW) / 2), y: Math.round(t + (vh - t - b - band - h) / 2), w: belowW, h },
    stick: { x: l + band * 0.7, y, r: size },
    jump: { x: vw - r - band * 0.7, y, r: size },
    pause: { x: (l + vw - r) / 2, y, r: 24 },
  };
}
