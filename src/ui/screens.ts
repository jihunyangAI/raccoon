import type { Sound } from '../core/audio';
import { FONT, H, W, rng } from '../core/const';
import { keyName, type Input } from '../core/input';
import type { Bindable, Save } from '../core/save';
import { MAX_SCORES, NAME_CHARS, NAME_LENGTH } from '../core/scores';
import { paintFar, paintSky, themeFor } from '../render/backgrounds';
import * as D from '../render/draw';
import { ZNAME, ZONES, fmtTime } from '../render/scene';

type C = CanvasRenderingContext2D;

export interface Item {
  label?: string; x: number; y: number; w: number; h: number; locked?: boolean;
  /** 글자 크기를 직접 정할 때 */
  size?: number;
  draw?: (it: Item, selected: boolean) => void;
}
export interface Result { fruit: number; timeBonus: number; maxCombo: number; rank: string; gold: boolean; bonus: boolean; total: number; final?: boolean }

const RANK: Record<string, string> = { S: '#ffd84a', A: '#8dffc0', B: '#9fd8ff', C: '#d8d2e8', '-': '#d8d2e8' };

const thumbs = new Map<number, HTMLCanvasElement>();
const TW = 198, TH = 138;

/** 스테이지 선택 칸에 들어가는 그림. 구역마다 풍경이 다르고, 스테이지마다 구성이 달라진다 */
function thumb(i: number): HTMLCanvasElement {
  let c = thumbs.get(i);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = TW * 2; c.height = TH * 2;
  thumbs.set(i, c);
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  const z = Math.floor(i / 6), k = i % 6, Z = ZONES[z], r = rng(i * 97 + 11);
  const sprite = (x: number, y: number, s: number, fn: () => void) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };

  // 실제 스테이지 배경을 축소해 그린다
  const theme = themeFor(z + 1, k), S = 0.16, LW = TW / S, LH = 116 / S;
  paintSky(g, TW, TH, theme);
  for (let s = 0; s < 22 * theme.stars; s++) D.ell(g, r() * TW, r() * TH * 0.6, 0.8, 0.8, 'rgba(255,255,255,.7)');
  // 스테이지가 뒤로 갈수록 달이 기운다
  const mr = z === 3 ? 20 : 13, mx = 168 - k * 27, my = 24 + k * 5;
  D.ell(g, mx, my, mr * 2, mr * 2, 'rgba(255,243,200,.13)');
  D.ell(g, mx, my, mr, mr, '#fff3c8');
  g.save();
  g.scale(S, S);
  paintFar(g, LW, LH, theme, z + 1, r);
  theme.paint(g, LW, LH, r, theme);
  g.restore();

  // 앞쪽 발판과 그 스테이지에 나오는 것들
  D.rr(g, -4, 116, TW + 8, 30, 0, Z.dark);
  D.rr(g, -4, 112, TW + 8, 7, 3, Z.top);
  if (z === 0) {
    sprite(28 + k * 6, 113, 0.5, () => D.burr(g, 0, 0));
    if (k >= 1) sprite(150 - k * 9, 113, 0.55, () => D.hog(g, 0, 0, -1, k));
  } else if (z === 1) {
    if (k >= 1) sprite(60 + k * 18, 62 - (k % 2) * 14, 0.55, () => D.bat(g, 0, 0, k * 0.4));
  } else if (z === 2) {
    if (k >= 1) { D.rr(g, 132 + (k % 2) * 14, 74 + k * 3, 40, 9, 4, Z.body); D.rr(g, 131 + (k % 2) * 14, 72 + k * 3, 42, 4, 2, '#ffd36b'); }
    if (k >= 3) sprite(60, 56, 0.5, () => D.bat(g, 0, 0, 1.2));
  } else if (k >= 1) {
    sprite(34 + ((k * 31) % 110), 113, 0.55, () => D.owl(g, 0, 0, 1, k >= 4 ? 'dash' : 'idle', 0));
  }

  // 6번째 스테이지는 위로 길게 이어지는 사다리
  if (k === 5) {
    g.strokeStyle = Z.ladder; g.lineWidth = 3; g.lineCap = 'round';
    for (const s of [-7, 7]) { g.beginPath(); g.moveTo(170 + s, 0); g.lineTo(170 + s, 110); g.stroke(); }
    for (let y = 8; y < 110; y += 11) { g.beginPath(); g.moveTo(163, y); g.lineTo(177, y); g.stroke(); }
  }
  for (let f = 0; f < 2 + (k % 2); f++) {
    const x = 22 + r() * (TW - 44), y = 60 + r() * 34, kind = Math.floor(r() * 4);
    D.ell(g, x, y, 11, 11, D.FRUIT[kind] + '44');
    sprite(x, y, 0.5, () => D.fruit(g, 0, 0, kind, false, 0));
  }
  return c;
}

/** 구역 이름 옆의 상징 그림 */
function emblem(g: C, x: number, y: number, z: number) {
  g.save();
  g.translate(x, y);
  if (z === 0) { g.scale(2.1, 2.1); D.fruit(g, 0, 3, 0, false, 0); }
  else if (z === 1) {
    g.strokeStyle = '#5fbf6a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-4, 30); g.quadraticCurveTo(10, 0, -2, -30); g.stroke();
    D.ell(g, -16, 12, 15, 8, '#7ed488', 0.6); D.ell(g, 18, -2, 15, 8, '#7ed488', -0.6); D.ell(g, -14, -18, 13, 7, '#7ed488', 0.5);
  } else if (z === 2) {
    g.strokeStyle = '#c9955a'; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); g.stroke();
      D.ell(g, Math.cos(a) * 28, Math.sin(a) * 28, 5, 5, '#9fd8ff');
    }
    D.ell(g, 0, 0, 6, 6, '#ffd36b');
  } else {
    D.ell(g, 4, -6, 24, 24, '#fff3c8');
    D.ell(g, 14, -12, 20, 20, 'rgb(30,32,78)');
    for (let p = 0; p < 4; p++) D.ell(g, -20 + p * 14, 22 + (p % 2) * 3, 13, 9, '#ffffff');
  }
  g.restore();
}

function padlock(g: C, x: number, y: number) {
  g.strokeStyle = '#e6e2ff'; g.lineWidth = 6;
  g.beginPath(); g.arc(x, y - 6, 13, Math.PI, 0); g.stroke();
  D.rr(g, x - 20, y - 6, 40, 32, 7, '#e6e2ff');
  D.ell(g, x, y + 8, 4.5, 4.5, '#2a2040');
  D.rr(g, x - 2, y + 9, 4, 9, 2, '#2a2040');
}

/** 캔버스에 직접 그리는 즉시 모드 UI. 키보드·게임패드·마우스를 모두 받는다 */
export class UI {
  sel = 0;
  constructor(private g: C, private input: Input, private audio: Sound) {}

  open(i = 0) { this.sel = i; }

  text(s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 800) {
    const g = this.g;
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  panel(x: number, y: number, w: number, h: number) {
    const g = this.g;
    D.rr(g, x, y, w, h, 30, 'rgba(14,16,48,.82)');
    g.strokeStyle = 'rgba(255,220,150,.4)';
    g.lineWidth = 3;
    g.beginPath(); g.roundRect(x, y, w, h, 30); g.stroke();
  }

  dim(a = 0.55) {
    this.g.fillStyle = `rgba(5,6,24,${a})`;
    this.g.fillRect(0, 0, W, H);
  }

  /** 항목을 그리고, 이번 프레임에 선택된 항목 번호를 돌려준다 (없으면 -1) */
  menu(items: Item[], cols = 1): number {
    const g = this.g, p = this.input.pressed, m = this.input.mouse, n = items.length;
    const old = this.sel;
    let s = Math.min(this.sel, n - 1), act = -1;
    if (p.has('down')) s += cols;
    if (p.has('up')) s -= cols;
    if (cols > 1) { if (p.has('right')) s++; if (p.has('left')) s--; }
    s = Math.max(0, Math.min(n - 1, s));
    items.forEach((it, i) => {
      const inside = m.x >= it.x && m.x <= it.x + it.w && m.y >= it.y && m.y <= it.y + it.h;
      if (inside && m.moved) s = i;
      if (inside && m.click) { s = i; act = i; }
    });
    if (s !== old) this.audio.sfx('ui');
    this.sel = s;
    if (p.has('ok')) act = s;

    items.forEach((it, i) => {
      const on = i === s;
      D.rr(g, it.x, it.y, it.w, it.h, 20, on ? 'rgba(255,212,120,.95)' : 'rgba(30,32,78,.85)');
      if (on) {
        g.strokeStyle = '#fff6d8'; g.lineWidth = 4;
        g.beginPath(); g.roundRect(it.x, it.y, it.w, it.h, 20); g.stroke();
      }
      if (it.locked) g.globalAlpha = 0.4;
      if (it.draw) it.draw(it, on);
      else if (it.label) this.text(it.label, it.x + it.w / 2, it.y + it.h / 2 + 2, it.size ?? Math.min(36, it.h * 0.42), on ? '#2a2040' : '#fff');
      g.globalAlpha = 1;
    });

    if (act >= 0) {
      if (items[act].locked) { this.audio.sfx('no'); return -1; }
      this.audio.sfx('ok');
    }
    return act;
  }

  private column(labels: string[], x: number, y: number, w = 460, h = 84): number {
    return this.menu(labels.map((label, i) => ({ label, x, y: y + i * (h + 18), w, h })));
  }

  /** 휴대폰·태블릿용 타이틀: 작은 화면에서도 읽고 누르기 쉽게 메뉴를 크게 둔다 */
  private touchTitle(t: number, hi: number): number {
    const g = this.g, w = 620, h = 205, gap = 28, x0 = (W - w * 2 - gap) / 2, y0 = 265;
    g.save();
    g.translate(205, 900);
    g.scale(3.2, 3.2);
    D.lumi(g, 0, 0, { dir: 1, state: 'ground', run: 0, climb: 0, t, vx: 0, vy: 0, squash: 0, stT: 0 });
    g.restore();
    g.shadowColor = 'rgba(255,200,110,.7)';
    g.shadowBlur = 36;
    this.text('2026너구리', W / 2, 115, 130, '#fff3c8', 'center', 900);
    g.shadowBlur = 0;
    if (hi > 0) this.text(`최고 ${hi}`, 60, 70, 44, '#ffd84a', 'left', 800);
    const labels = ['시작하기', '스테이지 선택', '타임어택', '점수판', '열매 도감', '설정'];
    const act = this.menu(labels.map((label, i) => ({
      label, size: 72, w, h, x: x0 + (i % 2) * (w + gap), y: y0 + Math.floor(i / 2) * (h + gap),
    })), 2);
    const [moveSide, jumpSide] = this.input.swapHands ? ['오른쪽', '왼쪽'] : ['왼쪽', '오른쪽'];
    this.text(`${moveSide}을 밀어 이동     ${jumpSide}을 눌러 점프`, W / 2, 1000, 44, '#c9c5e6', 'center', 700);
    return act;
  }

  title(t: number, hi: number): number {
    if (this.input.touchMode) return this.touchTitle(t, hi);
    const g = this.g;
    g.save();
    g.translate(430, 880);
    g.scale(4.2, 4.2);
    D.lumi(g, 0, 0, { dir: 1, state: 'ground', run: 0, climb: 0, t, vx: 0, vy: 0, squash: 0, stT: 0 });
    g.restore();
    g.shadowColor = 'rgba(255,200,110,.7)';
    g.shadowBlur = 40;
    this.text('2026너구리', W / 2 + 180, 220, 150, '#fff3c8', 'center', 900);
    g.shadowBlur = 0;
    this.text('달이 지기 전에 빛나는 열매를 모두 거두세요', W / 2 + 180, 335, 38, '#d8d2f0', 'center', 600);
    const act = this.column(['시작하기', '스테이지 선택', '타임어택', '점수판', '열매 도감', '설정'], 910, 400, 460, 62);
    const k = this.input.keyLabels;
    this.text(`이동 ${k.left} ${k.right}     오르기 ${k.up} ${k.down}     점프 ${k.jump}     내려가기 ${k.down} + ${k.jump}     일시정지 Esc`,
      W / 2, 1010, 26, '#a9a6d0', 'center', 600);
    if (hi > 0) this.text(`최고 점수 ${hi}`, 1140, 900, 30, '#ffd84a', 'center', 700);
    return act;
  }

  /** 0~23 스테이지 번호, 24 뒤로 */
  select(save: Save, count: number, timeAttack = false): number {
    this.dim(0.45);
    this.text(timeAttack ? '타임어택' : '스테이지 선택', W / 2, 90, 64, '#fff3c8', 'center', 900);
    const golds = Object.values(save.best).filter((b) => b.gold).length;
    this.text(`황금 열매 ${golds} / ${count}`, 80, 96, 30, '#ffd84a', 'left', 700);
    const g = this.g;
    for (let z = 0; z < 4; z++) {
      const cy = 255 + z * 185;
      D.rr(g, 70, cy - 46, 92, 92, 24, 'rgba(30,32,78,.85)');
      emblem(g, 116, cy, z);
      this.text(ZNAME[z], 180, cy, 30, '#d8d2f0', 'left', 800);
    }
    const items: Item[] = [];
    for (let i = 0; i < count; i++) {
      const z = Math.floor(i / 6), k = i % 6, b = save.best[i], locked = i > save.unlocked;
      items.push({
        x: 440 + k * 235, y: 180 + z * 185, w: 210, h: 150, locked,
        draw: (it) => {
          // 스테이지 그림 위에 번호, 랭크, 황금 열매를 얹는다
          const x = it.x + 6, y = it.y + 6, w = it.w - 12, h = it.h - 12;
          g.save();
          g.beginPath(); g.roundRect(x, y, w, h, 15); g.clip();
          g.drawImage(thumb(i), x, y, w, h);
          const band = g.createLinearGradient(0, y + h - 70, 0, y + h);
          band.addColorStop(0, 'rgba(8,10,34,0)');
          band.addColorStop(1, 'rgba(8,10,34,.9)');
          g.fillStyle = band;
          g.fillRect(x, y + h - 70, w, 70);
          g.restore();
          this.text(`${z + 1}-${k + 1}`, x + 14, y + h - 22, 32, '#fff', 'left', 900);
          if (locked) {
            g.globalAlpha = 1;
            D.rr(g, x, y, w, h, 15, 'rgba(8,10,34,.45)');
            padlock(g, it.x + it.w / 2, it.y + it.h / 2 - 8);
          } else if (timeAttack) {
            const rec = save.ta[i];
            D.rr(g, x + w - 112, y + h - 40, 100, 30, 15, rec ? 'rgba(8,10,34,.85)' : '#ffd84a');
            this.text(rec ? fmtTime(rec) : '도전', x + w - 62, y + h - 24, 20, rec ? '#ffd84a' : '#2a2040', 'center', 800);
          } else if (b) {
            g.shadowColor = 'rgba(0,0,0,.8)';
            g.shadowBlur = 8;
            this.text(b.rank, x + w - 58, y + h - 24, 40, RANK[b.rank], 'center', 900);
            g.shadowBlur = 0;
            if (b.gold) D.fruit(g, x + w - 22, y + h - 22, 0, true, 0);
            else {
              g.strokeStyle = 'rgba(255,255,255,.45)';
              g.lineWidth = 3;
              g.setLineDash([5, 5]);
              g.beginPath(); g.arc(x + w - 22, y + h - 24, 14, 0, Math.PI * 2); g.stroke();
              g.setLineDash([]);
            }
          } else {
            D.rr(g, x + w - 76, y + h - 40, 64, 30, 15, '#ffd84a');
            this.text('도전', x + w - 44, y + h - 24, 20, '#2a2040', 'center', 800);
          }
        },
      });
    }
    items.push({ label: '뒤로', x: 80, y: 950, w: 240, h: 76 });
    const act = this.menu(items, 6);
    if (this.input.pressed.has('back')) return count;
    return act;
  }

  /** 값이 바뀌면 'changed' */
  settings(save: Save): 'back' | 'changed' | 'fullscreen' | 'keys' | '' {
    this.dim(0.45);
    this.panel(560, 70, 800, 940);
    this.text('설정', W / 2, 140, 60, '#fff3c8', 'center', 900);
    const bar = (v: number) => '■'.repeat(Math.round(v * 10)) + '□'.repeat(10 - Math.round(v * 10));
    const onOff = (v: boolean) => (v ? '켜짐' : '꺼짐');
    const labels = [
      `효과음  ${bar(save.sfx)}`, `배경음  ${bar(save.music)}`,
      `화면 흔들림  ${onOff(save.shake)}`, `색맹 모드  ${onOff(save.colorSafe)}`,
      '키 변경', '전체 화면 전환',
      `터치 조작판  ${save.leftHanded ? '이동 오른쪽 · 점프 왼쪽' : '이동 왼쪽 · 점프 오른쪽'}`,
      '돌아가기',
    ];
    const act = this.column(labels, 660, 205, 600, 72);
    const p = this.input.pressed, d = (p.has('right') ? 0.1 : 0) - (p.has('left') ? 0.1 : 0);
    this.text('← → 또는 누르기로 조절', W / 2, 960, 24, '#a9a6d0', 'center', 600);
    const step = (v: number, dv: number) => Math.round(Math.max(0, Math.min(1, v + dv)) * 10) / 10;
    if (this.sel === 0 && (d || act === 0)) { save.sfx = step(save.sfx, d || (save.sfx >= 1 ? -1 : 0.1)); return 'changed'; }
    if (this.sel === 1 && (d || act === 1)) { save.music = step(save.music, d || (save.music >= 1 ? -1 : 0.1)); return 'changed'; }
    if (act === 2) { save.shake = !save.shake; return 'changed'; }
    if (act === 3) { save.colorSafe = !save.colorSafe; return 'changed'; }
    if (act === 4) return 'keys';
    if (act === 5) return 'fullscreen';
    if (act === 6) { save.leftHanded = !save.leftHanded; return 'changed'; }
    if (act === 7 || p.has('back')) return 'back';
    return '';
  }

  /** 0~4 키 바꾸기, 5 기본값, 6 돌아가기 */
  keys(save: Save, order: Bindable[], waiting: number): number {
    this.dim(0.45);
    this.panel(560, 70, 800, 940);
    this.text('키 변경', W / 2, 140, 60, '#fff3c8', 'center', 900);
    const names: Record<Bindable, string> = { left: '왼쪽', right: '오른쪽', up: '위', down: '아래', jump: '점프' };
    const labels = order.map((a, i) => `${names[a]}  :  ${i === waiting ? '새 키를 누르세요' : keyName(save.keys[a])}`);
    const act = this.column([...labels, '기본값으로', '돌아가기'], 660, 215, 600, 76);
    this.text(waiting >= 0 ? 'Esc를 누르거나 화면을 누르면 취소' : 'WASD와 Z는 겹치지 않는 한 함께 쓸 수 있습니다', W / 2, 960, 24, '#a9a6d0', 'center', 600);
    if (waiting >= 0) return -1;
    return this.input.pressed.has('back') ? 6 : act;
  }

  /** 점수판. 확인을 누르면 0 */
  scores(save: Save, highlight: number, t: number): number {
    const g = this.g, medal = ['#ffd84a', '#d8dcec', '#e0a070'];
    this.dim(0.55);
    this.panel(340, 40, 1240, 1000);
    this.text('점수판', W / 2, 110, 60, '#fff3c8', 'center', 900);
    const X = { rank: 430, name: 560, score: 1000, stage: 1200, date: 1490 };
    const head = 176;
    this.text('순위', X.rank, head, 24, '#a9a6d0', 'center', 700);
    this.text('이름', X.name, head, 24, '#a9a6d0', 'left', 700);
    this.text('점수', X.score, head, 24, '#a9a6d0', 'right', 700);
    this.text('도달', X.stage, head, 24, '#a9a6d0', 'center', 700);
    this.text('날짜', X.date, head, 24, '#a9a6d0', 'right', 700);
    for (let i = 0; i < MAX_SCORES; i++) {
      const y = 232 + i * 64, e = save.scores[i], color = i < 3 ? medal[i] : '#fff';
      if (i === highlight) D.rr(g, 380, y - 28, 1160, 56, 14, `rgba(255,212,120,${0.28 + Math.sin(t * 5) * 0.1})`);
      else if (i % 2 === 0) D.rr(g, 380, y - 28, 1160, 56, 14, 'rgba(255,255,255,.04)');
      this.text(String(i + 1), X.rank, y, 32, e ? color : '#5f5d88', 'center', 900);
      if (!e) { this.text('---', X.name, y, 30, '#5f5d88', 'left', 700); continue; }
      this.text(e.name, X.name, y, 32, color, 'left', 800);
      this.text(e.score.toLocaleString('ko-KR'), X.score, y, 34, color, 'right', 900);
      this.text(e.stage, X.stage, y, 24, '#d8d2f0', 'center', 700);
      this.text(e.date, X.date, y, 22, '#a9a6d0', 'right', 600);
    }
    const act = this.menu([{ label: '확인', x: 840, y: 900, w: 240, h: 76 }]);
    return this.input.pressed.has('back') ? 0 : act;
  }

  /** 글자 번호, NAME_CHARS.length는 지우기, 그다음은 완료 */
  nameEntry(name: string, score: number, rank: number): number {
    const g = this.g, n = NAME_CHARS.length;
    this.dim(0.6);
    this.panel(370, 50, 1180, 950);
    this.text(`새 기록! ${rank + 1}위`, W / 2, 125, 56, '#ffd84a', 'center', 900);
    this.text(`${score.toLocaleString('ko-KR')}점`, W / 2, 200, 40);
    for (let i = 0; i < NAME_LENGTH; i++) {
      const x = W / 2 - 130 + i * 130, cur = i === name.length;
      D.rr(g, x - 52, 250, 104, 120, 16, cur ? 'rgba(255,212,120,.3)' : 'rgba(30,32,78,.9)');
      this.text(name[i] ?? '', x, 312, 72, '#fff', 'center', 900);
    }
    this.text('이름을 입력하세요 (영문·숫자 3자)', W / 2, 410, 26, '#a9a6d0', 'center', 600);
    const items: Item[] = [...NAME_CHARS].map((label, i) => ({
      label, x: 430 + (i % 10) * 106, y: 450 + Math.floor(i / 10) * 92, w: 96, h: 80,
    }));
    items.push({ label: '지우기', x: 430 + 6 * 106, y: 726, w: 202, h: 80 });
    items.push({ label: '완료', x: 430 + 8 * 106, y: 726, w: 202, h: 80 });
    const act = this.menu(items, 10);
    this.text('키보드로 바로 입력해도 됩니다. Enter로 완료', W / 2, 900, 24, '#a9a6d0', 'center', 600);
    return this.input.pressed.has('back') ? n : act;
  }

  /** 열매 도감. 뒤로 가면 0 */
  dex(save: Save, count: number): number {
    const g = this.g;
    this.dim(0.5);
    this.text('열매 도감', W / 2, 80, 60, '#fff3c8', 'center', 900);
    const got = Object.values(save.best).filter((b) => b.gold).length;
    this.text(`황금 열매 ${got} / ${count}`, 80, 86, 30, '#ffd84a', 'left', 700);
    for (let i = 0; i < count; i++) {
      const z = Math.floor(i / 6), k = i % 6, b = save.best[i];
      const x = 150 + k * 275, y = 150 + z * 195, w = 250, h = 180;
      g.save();
      g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
      g.drawImage(thumb(i), x, y, w, h);
      g.fillStyle = b?.gold ? 'rgba(8,10,34,.35)' : 'rgba(8,10,34,.78)';
      g.fillRect(x, y, w, h);
      g.restore();
      if (b?.gold) {
        g.save(); g.translate(x + w / 2, y + 70); g.scale(1.7, 1.7); D.fruit(g, 0, 0, 0, true, 0); g.restore();
        this.text(themeFor(z + 1, k).name, x + w / 2, y + 150, 26);
      } else {
        this.text('?', x + w / 2, y + 70, 62, 'rgba(255,255,255,.35)', 'center', 900);
        this.text(`${z + 1}-${k + 1}`, x + w / 2, y + 150, 26, 'rgba(255,255,255,.55)', 'center', 700);
      }
    }
    const act = this.menu([{ label: '뒤로', x: 80, y: 960, w: 240, h: 76 }]);
    return this.input.pressed.has('back') ? 0 : act;
  }

  /** 0 다시 도전, 1 스테이지 선택 */
  timeResult(label: string, time: number, deaths: number, best: number, isNew: boolean): number {
    this.dim(0.5);
    this.panel(560, 190, 800, 680);
    this.text(`${label} 타임어택`, W / 2, 280, 56, '#fff3c8', 'center', 900);
    this.text(fmtTime(time), W / 2, 440, 110, '#ffd84a', 'center', 900);
    this.text(deaths ? `실수 ${deaths}번, ${deaths * 5}초 추가됨` : '실수 없음', W / 2, 550, 32, '#b9b6e0', 'center', 700);
    this.text(isNew ? '새 기록!' : `최고 기록 ${fmtTime(best)}`, W / 2, 620, 38, isNew ? '#8dffc0' : '#fff');
    return this.menu([{ label: '다시 도전', x: 620, y: 730, w: 320, h: 84 }, { label: '스테이지 선택', x: 980, y: 730, w: 320, h: 84 }], 2);
  }

  pause(): number {
    this.dim();
    this.panel(660, 220, 600, 640);
    this.text('일시정지', W / 2, 310, 60, '#fff3c8', 'center', 900);
    const act = this.column(['계속하기', '다시 시작', '스테이지 선택', '타이틀로'], 730, 400);
    return this.input.pressed.has('pause') ? 0 : act;
  }

  result(r: Result, label: string, t: number): number {
    this.dim(0.5);
    this.panel(510, 130, 900, 820);
    this.text(r.final ? '전 스테이지 클리어!' : r.bonus ? '보너스 끝!' : `${label} 클리어!`, W / 2, 220, 64, '#fff3c8', 'center', 900);
    const row = (name: string, value: string, y: number, color = '#fff') => {
      this.text(name, 620, y, 34, '#b9b6e0', 'left', 700);
      this.text(value, 1300, y, 38, color, 'right');
    };
    row('열매 점수', String(r.fruit), 330);
    if (!r.bonus) row('시간 보너스', `+${r.timeBonus}`, 400);
    row('최대 연속 수확', `${r.maxCombo}개`, 470);
    if (!r.bonus) row('황금 열매', r.gold ? '획득!' : '놓침', 540, r.gold ? '#ffd84a' : '#8f8cc0');
    row('총점', String(r.total), 630, '#ffd84a');
    if (!r.bonus) {
      this.text('달빛 랭크', 760, 760, 34, '#b9b6e0', 'center', 700);
      const g = this.g;
      g.save();
      g.translate(1000, 760);
      g.rotate(Math.sin(t * 2) * 0.06);
      g.shadowColor = RANK[r.rank];
      g.shadowBlur = 30;
      this.text(r.rank, 0, 0, 150, RANK[r.rank], 'center', 900);
      g.restore();
    }
    return this.menu([{ label: '다음으로', x: 560, y: 830, w: 260, h: 80 }, { label: '그만하기', x: 1100, y: 830, w: 260, h: 80 }], 2);
  }

  over(score: number, hi: number): number {
    this.dim(0.65);
    this.panel(610, 200, 700, 680);
    this.text('게임 오버', W / 2, 300, 72, '#ff8a7a', 'center', 900);
    this.text(`점수 ${score}`, W / 2, 410, 48);
    this.text(score >= hi && score > 0 ? '최고 점수 갱신!' : `최고 점수 ${hi}`, W / 2, 480, 32, '#ffd84a', 'center', 700);
    return this.column(['다시 도전', '스테이지 선택', '타이틀로'], 730, 550, 460, 80);
  }
}
