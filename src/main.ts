import { Sound } from './core/audio';
import { H, STEP, W } from './core/const';
import { Input, RESERVED } from './core/input';
import { touchLayout, type TouchLayout } from './core/layout';
import { DEFAULT_KEYS, loadSave, storeSave, type Bindable } from './core/save';
import { NAME_CHARS, NAME_LENGTH, insertScore, rankFor } from './core/scores';
import { World, type Fx, type Run } from './physics/world';
import { setColorSafe } from './render/draw';
import { Renderer } from './render/scene';
import { BONUS, DEFS } from './stages/defs';
import { generate } from './stages/gen';
import { UI, type Result } from './ui/screens';

type Scene = 'title' | 'select' | 'settings' | 'keys' | 'dex' | 'scores' | 'name' | 'play' | 'pause' | 'result' | 'timeResult' | 'over';

const BINDS: Bindable[] = ['left', 'right', 'up', 'down', 'jump'];
const DEATH_PENALTY = 5;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
const padCanvas = document.getElementById('pad') as HTMLCanvasElement;
const padG = padCanvas.getContext('2d')!;
const save = loadSave();
// 점수판이 생기기 전의 최고 점수도 잃지 않게 옮겨 둔다
if (!save.scores.length && save.hi > 0) save.scores = [{ name: '이전', score: save.hi, stage: '-', date: '-' }];
const input = new Input(canvas, save.keys);
const audio = new Sound();
audio.sfxVol = save.sfx;
audio.musVol = save.music;
setColorSafe(save.colorSafe);
input.swapHands = save.leftHanded;
input.onFirst = () => audio.unlock();
input.onFirstTouch = () => {
  // 휴대폰에서는 주소창을 치우고 가로로 고정한다 (지원하지 않는 기기는 그대로 진행)
  const el = document.documentElement;
  if (!el.requestFullscreen) return;
  el.requestFullscreen()
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
};
const R = new Renderer(g);
R.shakeOn = save.shake;
const ui = new UI(g, input, audio);

let scene: Scene = 'title';
let run: Run = { lives: 3, score: 0, nextLife: 20000, loop: 0 };
let world: World;
let stageIdx = 0;
let timeAttack = false;
let waitingKey = -1;
let menuLock = 0; // 결과 화면이 뜬 직후 점프 연타로 넘어가지 않게 입력을 잠시 막는다
let recorded = false; // 이번 판 점수를 이미 처리했는가
let playerName = '';
let scoreRank = -1;
let highlight = -1;
let afterScores: (() => void) | undefined;
let jumpQ = false;
let acc = 0;
let scale = 1;
let time = 0;
let maxDpr = 2;
let padDpr = 1;
let layout: TouchLayout | undefined;
let frameAvg = 1 / 60;
let slowFor = 0;
let res: Result = { fruit: 0, timeBonus: 0, maxCombo: 0, rank: 'C', gold: false, bonus: false, total: 0 };
let taRes = { time: 0, deaths: 0, best: 0, isNew: false };

const isFinalStage = () => !timeAttack && !world.st.bonus && stageIdx === DEFS.length - 1;

const fx: Fx = (type, x, y, arg) => {
  R.spawn(type, x, y, arg);
  // 클리어하는 순간 브라스 징글이 한 번 울린다. 마지막 스테이지는 엔딩 징글
  if (type === 'clear') audio.jingle(isFinalStage() ? 'ending' : 'win');
  else audio.sfx(type, arg);
};
const taTime = () => world.clock + world.deaths * DEATH_PENALTY;

function go(s: Scene, sel = 0) {
  scene = s;
  // 일시정지에서 그만두고 이름을 적는 동안에도 음악은 멈춘 채로 둔다
  audio.setPaused(s === 'pause' || (audio.paused && (s === 'name' || s === 'scores')));
  menuLock = s === 'result' || s === 'timeResult' || s === 'over' || s === 'name' ? 0.6 : 0;
  ui.open(sel);
  input.capture = s === 'name' ? typeName : undefined;
  input.clear();
  input.releaseTouches();
  jumpQ = false;
}

function startStage(i: number, bonus = false) {
  stageIdx = i;
  const st = generate(bonus ? BONUS[DEFS[i].zone - 1] : DEFS[i], i, run.loop);
  world = new World(st, run, fx);
  R.build(st);
  audio.play(bonus ? 'bonus' : `z${st.zone}`);
  acc = 0;
  go('play');
}

function newRun(i: number, ta = timeAttack) {
  timeAttack = ta;
  recorded = false;
  run = { lives: 3, score: 0, nextLife: 20000, loop: 0 };
  startStage(i);
}

/** 판이 끝날 때 호출. 10위 안이면 이름을 받고 점수판을 보여 준 뒤 then으로 이어진다 */
function finishRun(then: () => void) {
  if (timeAttack || recorded) { then(); return; }
  recorded = true;
  save.hi = Math.max(save.hi, run.score);
  storeSave(save);
  scoreRank = rankFor(save.scores, run.score);
  if (scoreRank < 0) { then(); return; }
  afterScores = then;
  playerName = save.lastName;
  go('name', playerName ? NAME_CHARS.length + 1 : 0);
}

function confirmName() {
  if (!playerName) { audio.sfx('no'); return; }
  const d = new Date(), pad = (n: number) => String(n).padStart(2, '0');
  const lap = run.loop ? `${run.loop + 1}회차 ` : '';
  const result = insertScore(save.scores, {
    name: playerName, score: run.score,
    stage: `${lap}${world.st.zone}-${(stageIdx % 6) + 1}`,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  });
  save.scores = result.list;
  save.lastName = playerName;
  storeSave(save);
  highlight = result.rank;
  audio.sfx('life');
  go('scores');
}

function typeName(code: string) {
  if (menuLock > 0) return;
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) {
    if (playerName.length < NAME_LENGTH) { playerName += m[1]; audio.sfx('ui'); } else audio.sfx('no');
  } else if (code === 'Backspace') playerName = playerName.slice(0, -1);
  else if (code === 'Enter') confirmName();
  else input.inject(code);
}

function toMenu(s: 'title' | 'select', sel = 0) {
  if (s === 'title') timeAttack = false;
  R.build(generate(DEFS[0], 0));
  audio.play('title');
  go(s, sel);
}

function finishTimeAttack() {
  const t = taTime(), old = save.ta[stageIdx], isNew = !old || t < old;
  if (isNew) save.ta[stageIdx] = t;
  storeSave(save);
  taRes = { time: t, deaths: world.deaths, best: save.ta[stageIdx], isNew };
  go('timeResult');
}

function finishStage() {
  if (timeAttack) { finishTimeAttack(); return; }
  const w = world, st = w.st;
  const timeBonus = st.bonus ? 0 : Math.floor(w.timeLeft) * 20;
  w.add(timeBonus);
  let rank = '-';
  if (!st.bonus) {
    // 달빛 랭크: 남은 시간, 최대 콤보, 무피격
    const tr = w.timeLeft / st.time, cr = w.maxCombo / w.fruitsTotal;
    const pts = (tr >= 0.45 ? 2 : tr >= 0.25 ? 1 : 0) + (cr >= 0.5 ? 2 : cr >= 0.25 ? 1 : 0) + (w.deaths === 0 ? 2 : 0);
    rank = pts >= 5 ? 'S' : pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';
    const b = save.best[stageIdx], order = 'CBAS';
    save.best[stageIdx] = {
      score: Math.max(b?.score ?? 0, w.stageScore),
      rank: b && order.indexOf(b.rank) > order.indexOf(rank) ? b.rank : rank,
      gold: (b?.gold ?? false) || w.gold,
    };
    save.unlocked = Math.max(save.unlocked, Math.min(DEFS.length - 1, stageIdx + 1));
  }
  save.hi = Math.max(save.hi, run.score);
  storeSave(save);
  res = { fruit: w.stageScore - timeBonus, timeBonus, maxCombo: w.maxCombo, rank, gold: w.gold, bonus: st.bonus, total: run.score, final: isFinalStage() };
  go('result');
}

function nextStage() {
  if (world.st.bonus) {
    if (stageIdx + 1 >= DEFS.length) { run.loop++; startStage(0); } // 2회차: 더 빠르고 시간이 짧다
    else startStage(stageIdx + 1);
  } else if (stageIdx % 6 === 5) startStage(stageIdx, true);
  else startStage(stageIdx + 1);
}

const padWanted = () => input.touchMode && scene === 'play';

function safeInsets() {
  const css = getComputedStyle(document.documentElement);
  const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
  return { l: px('--sl'), r: px('--sr'), t: px('--st'), b: px('--sb') };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const vw = innerWidth, vh = innerHeight;
  // 터치 플레이 중에는 게임을 줄여 조작판 자리를 따로 비운다
  layout = padWanted() ? touchLayout(vw, vh, safeInsets(), save.leftHanded) : undefined;
  input.layout = layout;
  const box = layout?.game;
  const s = box ? box.w / W : Math.min(vw / W, vh / H);
  const cw = box ? box.w : Math.floor(W * s), ch = box ? box.h : Math.floor(H * s);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  canvas.style.position = box ? 'fixed' : '';
  canvas.style.left = box ? `${box.x}px` : '';
  canvas.style.top = box ? `${box.y}px` : '';
  canvas.width = Math.max(1, Math.round(cw * dpr));
  canvas.height = Math.max(1, Math.round(ch * dpr));
  scale = canvas.width / W;

  padDpr = dpr;
  padCanvas.style.display = layout ? 'block' : 'none';
  if (layout) {
    padCanvas.style.width = `${vw}px`;
    padCanvas.style.height = `${vh}px`;
    padCanvas.width = Math.round(vw * dpr);
    padCanvas.height = Math.round(vh * dpr);
  }
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
resize();
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (document.hidden && scene === 'play') go('pause');
});

/** 프레임이 계속 밀리면 해상도와 빛 효과를 낮춘다 */
function watchPerformance(dt: number) {
  frameAvg += (dt - frameAvg) * 0.05;
  slowFor = frameAvg > 1 / 40 ? slowFor + dt : 0;
  if (slowFor > 2 && !R.low) {
    R.low = true;
    maxDpr = 1;
    resize();
  }
}

function update(dt: number) {
  if (scene !== 'play') { R.update(dt); return; }
  if (input.touchMode && innerHeight > innerWidth) { go('pause'); return; }
  if (input.pressed.has('pause')) { audio.sfx('ui'); go('pause'); return; }
  if (input.pressed.has('jump')) jumpQ = true;
  const h = input.held;
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    world.update(STEP, {
      left: h.has('left'), right: h.has('right'), up: h.has('up'), down: h.has('down'),
      jump: h.has('jump'), jumpPressed: jumpQ,
      assist: !!layout, autoClimb: !!layout && !input.stick,
    });
    jumpQ = false;
    if (world.status === 'lost') {
      if (!timeAttack) run.lives--;
      if (run.lives <= 0) {
        audio.stop();
        audio.sfx('over');
        finishRun(() => go('over'));
        return;
      }
      world.respawn();
    } else if (world.status === 'clear') { finishStage(); return; }
  }
  // 남은 시간이 20% 아래로 내려가면 음악이 빨라진다
  const ratio = world.timeLeft / world.st.time;
  audio.tempoScale = world.st.bonus || world.p.state === 'cheer' || ratio > 0.2 ? 1 : 1 + (0.2 - ratio) * 1.3;
  R.update(dt, world);
}

function applySettings() {
  audio.sfxVol = save.sfx;
  audio.musVol = save.music;
  audio.applyVolume();
  R.shakeOn = save.shake;
  setColorSafe(save.colorSafe);
  input.swapHands = save.leftHanded;
  storeSave(save);
}

function bindKey(code: string) {
  const i = waitingKey;
  waitingKey = -1;
  input.capture = undefined;
  input.clear();
  if (code === 'Escape') return;
  if (RESERVED.includes(code)) { audio.sfx('no'); return; }
  const action = BINDS[i], other = BINDS.find((a) => save.keys[a] === code);
  if (other) save.keys[other] = save.keys[action]; // 이미 쓰는 키면 서로 맞바꾼다
  save.keys[action] = code;
  input.setKeys(save.keys);
  storeSave(save);
  audio.sfx('ok');
}

function menuScreens() {
  if (scene === 'title') {
    const a = ui.title(time, save.hi);
    if (a === 0) newRun(0, false);
    else if (a === 1) { timeAttack = false; go('select', Math.min(save.unlocked, DEFS.length - 1)); }
    else if (a === 2) { timeAttack = true; go('select', Math.min(save.unlocked, DEFS.length - 1)); }
    else if (a === 3) { highlight = -1; afterScores = undefined; go('scores'); }
    else if (a === 4) go('dex');
    else if (a === 5) go('settings');
  } else if (scene === 'scores') {
    if (ui.scores(save, highlight, time) === 0) {
      const next = afterScores;
      afterScores = undefined;
      if (next) next(); else go('title', 3);
    }
  } else if (scene === 'name') {
    const a = ui.nameEntry(playerName, run.score, scoreRank), n = NAME_CHARS.length;
    if (a === n) playerName = playerName.slice(0, -1);
    else if (a === n + 1) confirmName();
    else if (a >= 0 && playerName.length < NAME_LENGTH) playerName += NAME_CHARS[a];
  } else if (scene === 'select') {
    const a = ui.select(save, DEFS.length, timeAttack);
    if (a === DEFS.length) { const back = timeAttack ? 2 : 1; timeAttack = false; go('title', back); }
    else if (a >= 0) newRun(a);
  } else if (scene === 'dex') {
    if (ui.dex(save, DEFS.length) === 0) go('title', 4);
  } else if (scene === 'settings') {
    const a = ui.settings(save);
    if (a === 'changed') { applySettings(); audio.sfx('pick', 1); }
    else if (a === 'keys') go('keys');
    else if (a === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (a === 'back') go('title', 5);
  } else {
    const waiting = waitingKey >= 0;
    const a = ui.keys(save, BINDS, waitingKey);
    if (waiting) {
      // 키보드가 없는 기기도 빠져나올 수 있게 터치·클릭·게임패드로 취소한다
      if (input.mouse.click || input.pressed.has('back')) { waitingKey = -1; input.capture = undefined; }
    } else if (a >= 0 && a < BINDS.length) { waitingKey = a; input.capture = bindKey; }
    else if (a === 5) { save.keys = { ...DEFAULT_KEYS }; input.setKeys(save.keys); storeSave(save); }
    else if (a === 6) go('settings', 4);
  }
}

function render() {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  if (scene === 'title' || scene === 'select' || scene === 'settings' || scene === 'keys' || scene === 'dex' || scene === 'scores' || scene === 'name') {
    R.backdrop(0.92, time, [1780, 120]); // 메뉴에서는 달이 제목을 가리지 않게 구석에 둔다
    R.ambient(time);
    menuScreens();
    return;
  }

  R.ladderHint = layout ? world.ladderHint() : { up: false, down: false };
  R.draw(world, scene === 'play' ? acc / STEP : 1, time);
  R.hud(world, run, save.hi, time, timeAttack ? taTime() : undefined);
  if (layout) {
    padG.setTransform(padDpr, 0, 0, padDpr, 0, 0);
    padG.clearRect(0, 0, innerWidth, innerHeight);
    R.controls(padG, input, layout);
  }
  if (scene === 'pause') {
    const a = ui.pause();
    if (a === 0) go('play');
    else if (a === 1) finishRun(() => newRun(stageIdx));
    else if (a === 2) finishRun(() => toMenu('select', stageIdx));
    else if (a === 3) finishRun(() => toMenu('title'));
  } else if (scene === 'result') {
    const a = ui.result(res, world.st.label, time);
    if (a === 0) nextStage();
    else if (a === 1) finishRun(() => toMenu('select', Math.min(save.unlocked, stageIdx + 1)));
  } else if (scene === 'timeResult') {
    const a = ui.timeResult(world.st.label, taRes.time, taRes.deaths, taRes.best, taRes.isNew);
    if (a === 0) newRun(stageIdx);
    else if (a === 1) toMenu('select', stageIdx);
  } else if (scene === 'over') {
    const a = ui.over(run.score, save.hi);
    if (a === 0) newRun(stageIdx);
    else if (a === 1) toMenu('select', stageIdx);
    else if (a === 2) toMenu('title');
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;
  watchPerformance(dt);
  input.playing = scene === 'play';
  if (padWanted() !== !!layout) resize();
  input.poll();
  if (menuLock > 0) {
    menuLock -= dt;
    input.pressed.clear();
    input.mouse.click = false;
  }
  update(dt);
  render();
  input.clear();
  requestAnimationFrame(frame);
}

toMenu('title');
requestAnimationFrame(frame);

// 개발 중 확인용 훅 (배포 빌드에는 포함되지 않는다)
if (import.meta.env.DEV) {
  Object.assign(window, {
    __game: { startStage, newRun, go, input, audio, get world() { return world; }, get scene() { return scene; }, save, R },
  });
}
