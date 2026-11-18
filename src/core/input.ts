import { H, W } from './const';
import type { TouchLayout } from './layout';
import type { KeyMap } from './save';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'pause' | 'ok' | 'back';

const FIXED: Record<string, Action[]> = {
  Enter: ['ok'], Escape: ['pause', 'back'], KeyP: ['pause'], Backspace: ['back'],
};
const ALT: Record<string, Action> = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyZ: 'jump' };

export const RESERVED = Object.keys(FIXED);
export const STICK_R = 110;

export function keyName(code: string) {
  const arrows: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  return arrows[code] ?? code.replace(/^Key|^Digit/, '');
}

export class Input {
  held = new Set<Action>();
  pressed = new Set<Action>();
  mouse = { x: 0, y: 0, click: false, moved: false };
  onFirst?: () => void;
  onFirstTouch?: () => void;
  /** 설정에서 키를 바꾸는 동안 다음 입력을 받아 간다 */
  capture?: (code: string) => void;
  touchMode = false;
  playing = false;
  /** 터치 플레이 중의 조작판 배치 */
  layout?: TouchLayout;
  keyLabels: Record<'left' | 'right' | 'up' | 'down' | 'jump', string> = { left: '', right: '', up: '', down: '', jump: '' };
  stick: { id: number; cx: number; cy: number; x: number; y: number } | null = null;
  jumpTouch: number | null = null;
  private keys: Record<string, Action[]> = {};
  private codes = new Set<string>();
  private padPrev = new Set<Action>();

  constructor(private canvas: HTMLCanvasElement, keys: KeyMap) {
    this.setKeys(keys);
    addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        if (!e.repeat) this.capture(e.code);
        return;
      }
      const a = this.keys[e.code];
      if (!a) return;
      e.preventDefault();
      this.onFirst?.();
      if (e.repeat) return;
      this.codes.add(e.code);
      a.forEach((x) => this.pressed.add(x));
    });
    addEventListener('keyup', (e) => this.codes.delete(e.code));
    addEventListener('blur', () => { this.codes.clear(); this.releaseTouches(); });
    canvas.addEventListener('mousemove', (e) => { this.setMouse(e.clientX, e.clientY); this.mouse.moved = true; });
    canvas.addEventListener('mousedown', (e) => { this.setMouse(e.clientX, e.clientY); this.mouse.click = true; this.onFirst?.(); });

    const opts = { passive: false };
    // 화면 양옆 검은 여백에 놓인 엄지도 받도록 문서 전체에서 듣는다
    document.addEventListener('touchstart', (e) => this.touchStart(e), opts);
    document.addEventListener('touchmove', (e) => this.touchMove(e), opts);
    document.addEventListener('touchend', (e) => this.touchEnd(e), opts);
    document.addEventListener('touchcancel', (e) => this.touchEnd(e), opts);
  }

  setKeys(k: KeyMap) {
    const map: Record<string, Action[]> = {};
    for (const [code, a] of Object.entries(FIXED)) map[code] = [...a];
    for (const [action, code] of Object.entries(k)) map[code] = action === 'jump' ? ['jump', 'ok'] : [action as Action];
    for (const [code, action] of Object.entries(ALT)) if (!map[code]) map[code] = action === 'jump' ? ['jump', 'ok'] : [action];
    this.keys = map;
    this.codes.clear();
    this.keyLabels = {
      left: keyName(k.left), right: keyName(k.right), up: keyName(k.up), down: keyName(k.down), jump: keyName(k.jump),
    };
  }

  private logical(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  }

  private setMouse(cx: number, cy: number) {
    const p = this.logical(cx, cy);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  }

  /** 스틱 좌표: 조작판 고리 반지름이 STICK_R이 되도록 맞춰 화면 크기와 무관하게 같은 감도를 낸다 */
  private stickPoint(t: Touch) {
    const k = STICK_R / (this.layout?.stick.r ?? 50);
    return { x: t.clientX * k, y: t.clientY * k };
  }

  private touchStart(e: TouchEvent) {
    e.preventDefault();
    this.touchMode = true;
    this.onFirst?.();
    for (const t of Array.from(e.changedTouches)) {
      const pause = this.layout?.pause;
      if (!this.playing) {
        const p = this.logical(t.clientX, t.clientY);
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.mouse.moved = true; this.mouse.click = true;
      } else if (pause && Math.hypot(t.clientX - pause.x, t.clientY - pause.y) < pause.r + 14) {
        this.pressed.add('pause');
      } else if (t.clientX < innerWidth / 2) {
        // 왼손은 닿은 자리가 스틱 중심이 된다
        const p = this.stickPoint(t);
        if (!this.stick) this.stick = { id: t.identifier, cx: p.x, cy: p.y, x: p.x, y: p.y };
      } else if (this.jumpTouch === null) {
        this.jumpTouch = t.identifier;
        this.pressed.add('jump');
      }
    }
  }

  private touchMove(e: TouchEvent) {
    e.preventDefault();
    const s = this.stick;
    if (!s) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== s.id) continue;
      const p = this.stickPoint(t);
      s.x = p.x; s.y = p.y;
      // 손가락이 멀어지면 중심도 따라와 방향 전환이 빨라진다
      const dx = s.x - s.cx, dy = s.y - s.cy, d = Math.hypot(dx, dy);
      if (d > STICK_R) { s.cx = s.x - (dx / d) * STICK_R; s.cy = s.y - (dy / d) * STICK_R; }
    }
  }

  private touchEnd(e: TouchEvent) {
    e.preventDefault();
    // 소리 잠금 해제와 전체 화면은 손을 뗄 때가 가장 확실하게 허용된다
    this.onFirst?.();
    this.onFirstTouch?.();
    this.onFirstTouch = undefined;
    for (const t of Array.from(e.changedTouches)) {
      if (this.stick?.id === t.identifier) this.stick = null;
      if (this.jumpTouch === t.identifier) this.jumpTouch = null;
    }
  }

  /** 입력을 가로챈 화면에서 메뉴 조작 키를 평소처럼 넘긴다 */
  inject(code: string) { this.keys[code]?.forEach((a) => this.pressed.add(a)); }

  releaseTouches() { this.stick = null; this.jumpTouch = null; }

  /** 프레임마다 호출: 게임패드와 터치를 읽고 held 상태를 갱신한다 */
  poll() {
    const pad = new Set<Action>();
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (ax < -0.4 || b(14)) pad.add('left');
      if (ax > 0.4 || b(15)) pad.add('right');
      if (ay < -0.5 || b(12)) pad.add('up');
      if (ay > 0.5 || b(13)) pad.add('down');
      if (b(0)) { pad.add('jump'); pad.add('ok'); }
      if (b(1)) pad.add('back');
      if (b(9)) pad.add('pause');
    }
    for (const a of pad) if (!this.padPrev.has(a)) this.pressed.add(a);
    this.padPrev = pad;
    this.held = new Set(pad);
    for (const c of this.codes) this.keys[c]?.forEach((a) => this.held.add(a));
    if (this.stick) {
      const dx = this.stick.x - this.stick.cx, dy = this.stick.y - this.stick.cy;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy) * 0.6) this.held.add(dx < 0 ? 'left' : 'right');
      if (Math.abs(dy) > 38 && Math.abs(dy) > Math.abs(dx) * 0.7) this.held.add(dy < 0 ? 'up' : 'down');
    }
    if (this.jumpTouch !== null) this.held.add('jump');
  }

  clear() {
    this.pressed.clear();
    this.mouse.click = false;
    this.mouse.moved = false;
  }
}
