// 음원 파일 없이 Web Audio로 실시간 연주하는 3채널 칩튠 시퀀서와 효과음.
// 모든 곡은 이 게임을 위해 새로 쓴 멜로디다.

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' 같은 음이름을 주파수로. 옥타브가 없으면 oct 사용 */
export function freq(n: string, oct = 4): number {
  const m = /^([A-G])([#b]?)(\d)?/.exec(n);
  if (!m) return 0;
  const s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const o = m[3] ? +m[3] : oct;
  return 440 * Math.pow(2, (s - 9) / 12 + (o - 4));
}

interface Track { bpm: number; chords: string[]; mel: string[] }
const tr = (bpm: number, chords: string, mel: string): Track =>
  ({ bpm, chords: chords.split(' '), mel: mel.trim().split(/\s+/) });

/** 클리어 때 한 번만 울리는 브라스 밴드 징글. 음은 MIDI 번호, 시간은 박자 단위 */
export interface Jingle {
  bpm: number;
  beats: number;
  stabs: [number, number, number[]][]; // 시작, 길이, 화음
  bass: [number, number, number][];
  kick: number[];
  clap: number[];
  bell: number[];
  crash: number;
  sparkle: number[];
}

const maj = (r: number) => [r, r + 4, r + 7, r + 12];

function buildEnding(): Jingle {
  const j: Jingle = {
    bpm: 148, beats: 12, stabs: [], bass: [], kick: [9], clap: [], bell: [], crash: 9,
    sparkle: [77, 81, 84, 89, 93, 96],
  };
  // 같은 리듬이 단3도씩 올라가며 고조된다
  [57, 60, 63].forEach((r, i) => {
    const t = i * 3;
    for (const [at, len, root] of [[0, 0.4, r], [0.75, 0.3, r], [1.5, 0.4, r], [2, 0.3, r + 5], [2.5, 0.4, r + 7]]) {
      j.stabs.push([t + at, len, maj(root)]);
      j.bass.push([t + at, len, root - 24]);
    }
    j.kick.push(t, t + 1.5);
    j.clap.push(t + 1, t + 2.5);
    j.bell.push(t + 0.5, t + 1.25, t + 2.25);
  });
  j.stabs.push([9, 3, [53, 65, 69, 72, 77, 81]]);
  j.bass.push([9, 2.5, 29]);
  return j;
}

export const JINGLES: Record<'win' | 'ending', Jingle> = {
  win: {
    bpm: 132, beats: 7,
    stabs: [
      [0, 0.4, maj(58)], [0.75, 0.3, maj(58)], [1.5, 0.7, maj(63)],
      [2.5, 0.3, [60, 65, 69, 72]], [3, 0.3, [62, 65, 70, 74]], [3.5, 0.4, [63, 67, 72, 75]],
      [4, 0.3, [65, 69, 72, 77]], [4.5, 0.3, [65, 69, 72, 77]], [5, 2, [58, 62, 65, 70, 74, 77]],
    ],
    bass: [[0, 0.4, 34], [0.75, 0.3, 34], [1.5, 0.7, 39], [2.5, 0.3, 36], [3, 0.3, 38], [3.5, 0.4, 39], [4, 0.3, 41], [4.5, 0.3, 41], [5, 1.5, 34]],
    kick: [0, 1.5, 2.5, 4, 5], clap: [1, 3, 4.5], bell: [0.5, 1.25, 2, 2.75, 3.5, 4.25], crash: 5,
    sparkle: [82, 86, 89, 94],
  },
  ending: buildEnding(),
};

export const jingleSeconds = (j: Jingle) => (j.beats * 60) / j.bpm;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// 멜로디는 8분음표 단위, 한 줄이 한 마디. '-'는 쉼표.
export const TRACKS: Record<string, Track> = {
  title: tr(120, 'F Dm Bb C F Dm Bb C', `
    A4 - C5 - F5 - C5 -
    A4 - D5 - F5 - D5 -
    Bb4 - D5 - F5 - G5 F5
    E5 - C5 - G4 - C5 -
    F5 - A5 - C6 - A5 -
    F5 - A5 - D6 - A5 -
    G5 F5 D5 Bb4 D5 - F5 -
    E5 - G5 - C5 - - -`),
  z1: tr(160, 'C C F G C Am F G', `
    E5 G5 E5 C5 D5 E5 - G5
    E5 G5 E5 C5 D5 C5 - -
    F5 A5 F5 C5 D5 F5 - A5
    G5 B5 G5 D5 G5 - D5 -
    E5 G5 C6 G5 E5 G5 - C6
    A5 C6 A5 E5 A5 - E5 -
    F5 A5 G5 F5 E5 D5 C5 D5
    D5 - B4 D5 G5 - - -`),
  z2: tr(152, 'G Em C D G Em C D', `
    B4 D5 G5 D5 B4 D5 G5 -
    B4 E5 G5 E5 B4 E5 G5 -
    C5 E5 G5 E5 C5 E5 A5 G5
    F#5 D5 A4 D5 F#5 - A5 -
    G5 - B5 G5 D5 - G5 D5
    E5 - G5 E5 B4 - E5 B4
    C5 D5 E5 G5 E5 D5 C5 E5
    D5 - F#5 - A5 F#5 D5 -`),
  z3: tr(156, 'Am Am F G Am F G E', `
    A4 C5 E5 A5 E5 C5 E5 -
    A5 - E5 - C5 E5 A4 -
    F5 A5 C6 A5 F5 A5 C5 -
    G5 B5 D5 G5 B4 D5 G5 -
    A5 E5 C5 E5 A5 - C6 -
    A5 F5 C5 F5 A5 - F5 -
    G5 D5 B4 D5 G5 - B5 -
    G#5 E5 B4 E5 G#5 B5 E5 -`),
  z4: tr(168, 'D A Bm G D A G A', `
    F#5 A5 D6 A5 F#5 A5 D6 -
    E5 A5 C#6 A5 E5 A5 C#6 -
    D5 F#5 B5 F#5 D5 F#5 B5 A5
    G5 B5 D6 B5 G5 - D6 -
    D6 - A5 F#5 D5 F#5 A5 -
    C#6 - A5 E5 C#5 E5 A5 -
    B5 G5 D5 G5 B5 D6 B5 G5
    A5 - C#6 - E6 C#6 A5 -`),
  bonus: tr(184, 'C F C G C F C G', `
    C5 E5 G5 C6 G5 E5 G5 C6
    C5 F5 A5 C6 A5 F5 A5 C6
    E5 G5 C6 E6 C6 G5 C6 E6
    D5 G5 B5 D6 B5 G5 B5 -
    C6 G5 E5 G5 C6 G5 E5 G5
    C6 A5 F5 A5 C6 A5 F5 A5
    E6 C6 G5 C6 E6 C6 G5 C6
    D6 B5 G5 B5 D6 - G5 -`),
};

const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];

export class Sound {
  ctx?: AudioContext;
  sfxVol = 0.7;
  musVol = 0.5;
  tempoScale = 1;
  lastJingle = '';
  private jingleOut?: GainNode;
  private sfxG!: GainNode;
  private musG!: GainNode;
  private noiseBuf!: AudioBuffer;
  private want = '';
  private track?: Track;
  private step = 0;
  private nextT = 0;
  private hidden = false;
  paused = false;

  /** 첫 사용자 입력에서 호출 (브라우저 자동재생 정책) */
  unlock() {
    if (!this.ctx) {
      const c = (this.ctx = new AudioContext());
      this.sfxG = c.createGain();
      this.musG = c.createGain();
      this.sfxG.connect(c.destination);
      this.musG.connect(c.destination);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      setInterval(() => this.tick(), 25);
      if (this.want) { const w = this.want; this.want = ''; this.play(w); }
    }
    // iOS는 전화 등으로 끊기면 'interrupted' 상태가 되므로 running이 아니면 모두 깨운다
    if (!this.hidden && this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** 탭이나 앱이 뒤로 가면 소리를 멈추고, 돌아오면 이어서 재생한다 */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfxG.gain.value = this.sfxVol;
    this.musG.gain.value = this.paused ? 0 : this.musVol * 0.8;
  }

  /** 일시정지: 배경음악만 멈추고, 풀면 멈춘 자리부터 이어서 연주한다 (효과음은 그대로) */
  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    const c = this.ctx;
    if (!c) return;
    const gain = this.musG.gain;
    gain.cancelScheduledValues(c.currentTime);
    gain.setTargetAtTime(paused ? 0 : this.musVol * 0.8, c.currentTime, 0.015);
    if (!paused) this.nextT = c.currentTime + 0.05;
  }

  /** 배경음을 멈추고 징글을 한 번 연주한다 */
  jingle(name: keyof typeof JINGLES) {
    this.stop();
    this.lastJingle = name;
    const c = this.ctx;
    if (!c) return;
    const j = JINGLES[name], beat = 60 / j.bpm, t0 = c.currentTime + 0.04;
    const at = (b: number) => t0 + b * beat;
    const comp = c.createDynamicsCompressor(), out = c.createGain();
    out.gain.value = 1;
    comp.connect(out).connect(this.musG);
    this.jingleOut = out;
    for (const [b, len, notes] of j.stabs) for (const n of notes) this.brass(midi(n), len * beat, 0.05, at(b), comp);
    for (const [b, len, n] of j.bass) this.slapBass(midi(n), len * beat, at(b), comp);
    for (const b of j.kick) this.tone(150, 0.16, 'sine', 0.5, at(b), comp, 45);
    for (const b of j.clap) for (const d of [0, 0.012, 0.024]) this.burst(0.07, 0.16, at(b) + d, comp, 'bandpass', 1500);
    for (const b of j.bell) {
      for (const f of [587, 845]) this.tone(f, 0.09, 'square', 0.035, at(b), comp);
    }
    for (let b = 0; b < j.crash; b += 0.5) this.burst(0.04, 0.05, at(b), comp, 'highpass', 7000);
    this.burst(1.4, 0.16, at(j.crash), comp, 'highpass', 5000);
    j.sparkle.forEach((n, i) => this.tone(midi(n), 0.22, 'triangle', 0.1, at(j.crash + 0.25 * i), comp));
  }

  private cutJingle() {
    const out = this.jingleOut, c = this.ctx;
    if (!out || !c) return;
    this.jingleOut = undefined;
    out.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => out.disconnect(), 300);
  }

  /** 톱니파 두 개를 살짝 어긋나게 겹치고 필터를 여는 금관 소리 */
  private brass(f: number, dur: number, vol: number, when: number, dest: AudioNode) {
    const c = this.ctx!, flt = c.createBiquadFilter(), g = c.createGain(), end = when + dur;
    flt.type = 'lowpass';
    flt.Q.value = 2;
    flt.frequency.setValueAtTime(f * 1.2, when);
    flt.frequency.exponentialRampToValueAtTime(Math.min(7000, f * 7), when + 0.05);
    flt.frequency.exponentialRampToValueAtTime(f * 2.5, when + Math.max(0.12, dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.018);
    g.gain.setValueAtTime(vol, when + Math.max(0.02, dur * 0.75));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
    flt.connect(g).connect(dest);
    for (const detune of [-9, 9]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(f * 0.97, when);
      o.frequency.linearRampToValueAtTime(f, when + 0.04);
      o.connect(flt);
      o.start(when);
      o.stop(end + 0.08);
    }
  }

  private slapBass(f: number, dur: number, when: number, dest: AudioNode) {
    const c = this.ctx!, o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1400, when);
    flt.frequency.exponentialRampToValueAtTime(260, when + 0.14);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.3, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.05);
    o.connect(flt).connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur + 0.08);
  }

  private burst(dur: number, vol: number, when: number, dest: AudioNode, type: BiquadFilterType, freqHz: number) {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    s.loop = true;
    f.type = type;
    f.frequency.value = freqHz;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(when);
    s.stop(when + dur + 0.02);
  }

  play(name: string) {
    this.cutJingle();
    if (this.want === name) return;
    this.want = name;
    this.track = TRACKS[name];
    this.step = 0;
    this.tempoScale = 1;
    if (this.ctx) this.nextT = this.ctx.currentTime + 0.08;
  }

  stop() { this.cutJingle(); this.want = ''; this.track = undefined; }

  private tick() {
    const c = this.ctx, t = this.track;
    if (!c || !t || this.paused || c.state !== 'running') return;
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.12) {
      const spb = 60 / (t.bpm * this.tempoScale) / 2;
      this.schedule(t, this.step, this.nextT, spb);
      this.nextT += spb;
      this.step = (this.step + 1) % t.mel.length;
    }
  }

  private schedule(t: Track, i: number, when: number, spb: number) {
    const s = i % 8, root = t.chords[Math.floor(i / 8) % t.chords.length];
    const n = t.mel[i];
    if (n && n !== '-') this.tone(freq(n), spb * 0.62, 'square', 0.1, when, this.musG);
    if (s % 2 === 0) {
      const f = freq(root, 2) * (s === 4 ? 1.5 : s % 4 === 2 ? 2 : 1);
      this.tone(f, spb * 0.9, 'triangle', 0.24, when, this.musG);
    }
    if (s % 4 === 0) this.tone(140, 0.12, 'sine', 0.32, when, this.musG, 45);
    if (s % 4 === 2) this.noise(0.09, 0.11, when, this.musG, 1800);
    if (s % 2 === 1) this.noise(0.03, 0.05, when, this.musG, 6000);
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, when: number, dest: AudioNode, slide?: number) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, when);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.006);
    g.gain.setValueAtTime(vol, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur + 0.03);
  }

  private noise(dur: number, vol: number, when: number, dest: AudioNode, hp: number) {
    const c = this.ctx!;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(when);
    s.stop(when + dur + 0.02);
  }

  private seq(notes: number[], gap: number, type: OscillatorType = 'square', vol = 0.14, len = gap * 0.9) {
    const t = this.ctx!.currentTime;
    notes.forEach((f, i) => { if (f) this.tone(f, len, type, vol, t + i * gap, this.sfxG); });
  }

  sfx(name: string, arg?: number | string) {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime, o = this.sfxG;
    switch (name) {
      case 'pick': {
        // 콤보가 오를수록 한 음씩 올라간다
        const k = Math.max(0, Math.min(7, (Number(arg) || 1) - 1));
        const f = 660 * Math.pow(2, SCALE[k] / 12);
        this.seq([f, f * 1.5], 0.05, 'square', 0.13);
        break;
      }
      case 'gold': this.seq([784, 988, 1175, 1568, 1976], 0.06, 'square', 0.14); break;
      case 'jump': this.tone(280, 0.11, 'square', 0.1, t, o, 620); break;
      case 'land': this.noise(0.05, 0.12, t, o, 300); break;
      case 'die': this.seq([523, 466, 392, 311, 233, 175], 0.09, 'square', 0.16); break;
      case 'crumble': this.noise(0.25, 0.14, t, o, 500); break;
      case 'bonus': this.seq([523, 659, 784, 1047], 0.06, 'square', 0.14); break;
      case 'time': this.seq([880, 1320, 880, 1320], 0.07, 'triangle', 0.22); break;
      case 'wisp': this.tone(700, 0.45, 'sawtooth', 0.09, t, o, 180); break;
      case 'owl': this.tone(420, 0.3, 'triangle', 0.2, t, o, 300); break;
      case 'over': this.seq([392, 370, 349, 294, 262, 196], 0.18, 'triangle', 0.24, 0.3); break;
      case 'life': this.seq([659, 784, 1319, 1047, 1175, 1568], 0.07, 'square', 0.14); break;
      case 'tick': this.tone(1200, 0.05, 'square', 0.08, t, o); break;
      case 'ui': this.tone(520, 0.04, 'square', 0.07, t, o); break;
      case 'ok': this.seq([660, 990], 0.05, 'square', 0.1); break;
      case 'no': this.tone(160, 0.12, 'square', 0.1, t, o); break;
    }
  }
}
