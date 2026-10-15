import { seeded } from '../lib/math'
import { arrangementAt, BEAT, CUES, EIGHTHS_PER_CHORD, LAYERS, MOTIF, PROGRESSIONS, type Arrangement, type Cue, type Layer } from './score'
import { Sampler, type Fetcher, type Voice } from './sampler'
import type { Sample, SampleGroup } from './samples'

/**
 * The film's music, played from recordings of real instruments (VSCO 2 CE and
 * VCSL, public domain) and scheduled on the audio clock. The motif and chords
 * run in real time; scroll position decides which layers play, turns the music
 * to major when the keystone seats, and fires hits at the key transitions.
 *
 * The clock is explicit (`tick(now)`, `update(..., now)`), so the same engine
 * can render offline for a preview, without a browser.
 */

/** How far ahead notes are booked, in seconds. */
const LOOKAHEAD = 0.3
const EIGHTH = BEAT / 2
/** Master level: the full mix sits around -16 dB RMS, peaks clear of the clipper. */
const OUTPUT = 1

/** Each layer's level at full strength, balanced against the others. */
const LEVEL: Record<Layer | 'hits', number> = {
  drone: 0.4,
  hero: 0.85,
  double: 0.42,
  hands: 0.55,
  pizz: 0.42,
  jazz: 0.3,
  viola: 0.3,
  violin: 0.26,
  horn: 0.3,
  timp: 0.5,
  big: 0.62,
  hits: 0.75,
}

/** How much of each layer goes to the hall. */
const SEND: Record<Layer | 'hits', number> = {
  drone: 0.4,
  hero: 0.55,
  double: 0.6,
  hands: 0.25,
  pizz: 0.35,
  jazz: 0.5,
  viola: 0.5,
  violin: 0.6,
  horn: 0.5,
  timp: 0.4,
  big: 0.35,
  hits: 0.6,
}

/** What the opening needs first; the rest loads behind it. */
const FIRST: SampleGroup[] = ['cello', 'bass', 'cresc']
const REST: SampleGroup[] = ['frame', 'darbuka', 'pizz', 'bassPizz', 'vibes', 'hat', 'shaker', 'viola', 'violin', 'horn', 'timp', 'kick', 'gong', 'cymbal']

const lowDrum = (s: Sample) => s.drum === 'low' && !s.muted
const timpStroke = (s: Sample) => !s.roll

export class SoundEngine {
  readonly ctx: BaseAudioContext
  /** Resolves once every sample has loaded (or failed to). */
  readonly ready: Promise<void>
  private out: GainNode
  private reverb: ConvolverNode
  private bus = {} as Record<Layer | 'hits', GainNode>
  private levels = {} as Record<Layer | 'hits', number>
  private sampler: Sampler
  private rand = seeded(7)

  private mix: Arrangement = arrangementAt(0)
  private mode: 'minor' | 'major' = 'minor'
  private chordIndex = -1
  private eighth = 0
  private nextTime = 0
  private pads: Voice[] = []
  private drone: Voice[] = []
  private running = false
  private timer = 0
  private lastP = -1

  /** Takes a context created and unlocked inside the user's click (see SoundToggle). */
  constructor(ctx: BaseAudioContext, fetch: Fetcher) {
    this.ctx = ctx
    this.sampler = new Sampler(ctx)
    // A soft clipper as the safety limit: transparent below about -6 dB, and the
    // same in every engine (a compressor's automatic make-up gain is not).
    const limiter = ctx.createWaveShaper()
    const curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.abs(x) < 0.5 ? x : Math.sign(x) * (0.5 + 0.5 * Math.tanh((Math.abs(x) - 0.5) / 0.5))
    }
    limiter.curve = curve
    limiter.oversample = '2x'
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(limiter).connect(ctx.destination)

    // The recordings carry their own room; a long hall around them makes it cinematic.
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.hall(4.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    this.reverb.connect(wet).connect(this.out)

    for (const name of [...LAYERS, 'hits'] as const) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.out)
      const send = ctx.createGain()
      send.gain.value = SEND[name]
      g.connect(send).connect(this.reverb)
      this.bus[name] = g
      this.levels[name] = 0
    }

    this.ready = this.sampler.load(FIRST, fetch).then(() => this.sampler.load(REST, fetch))
  }

  /** Fade the music in or out, and start or stop the clock (in the browser). */
  setOn(on: boolean, now = this.ctx.currentTime) {
    this.out.gain.cancelScheduledValues(now)
    this.out.gain.setTargetAtTime(on ? OUTPUT : 0, now, on ? 0.8 : 0.3)
    if (on && !this.running) {
      this.running = true
      this.nextTime = now + 0.1
      if (typeof window !== 'undefined') this.timer = window.setInterval(() => this.tick(this.ctx.currentTime), 50)
    } else if (!on && this.running) {
      this.running = false
      if (this.timer) clearInterval(this.timer)
      this.timer = 0
    }
  }

  /** Every frame: film progress and how far past the film the page is. */
  update(p: number, beyond: number, now = this.ctx.currentTime) {
    if (!Number.isFinite(p)) p = this.lastP < 0 ? 0 : this.lastP
    if (!Number.isFinite(beyond)) beyond = 0
    this.mix = arrangementAt(p)
    const level = this.mix.master * (1 - Math.min(1, beyond * 1.5))
    // Only move a layer's level when it changes, rather than queueing a ramp every frame.
    const set = (name: Layer | 'hits', value: number, tc: number) => {
      if (Math.abs(value - this.levels[name]) < 0.002) return
      this.levels[name] = value
      this.bus[name].gain.setTargetAtTime(value, now, tc)
    }
    for (const name of LAYERS) set(name, LEVEL[name] * this.mix[name] * level, name === 'big' ? 0.15 : 0.5)
    set('hits', LEVEL.hits * level, 0.15)

    // The release: change to major at once, from the top of the progression and the motif.
    if (this.mix.mode !== this.mode) {
      this.mode = this.mix.mode
      this.chordIndex = Math.ceil((this.chordIndex + 1) / 4) * 4 - 1
      this.eighth = 0
      this.nextTime = now + 0.04
    }

    // Hits fire only when passing their moment forwards, and not on a big jump.
    if (this.lastP >= 0 && p > this.lastP && p - this.lastP < 0.02) {
      for (const cue of CUES) if (cue.p > this.lastP && cue.p <= p) this.hit(cue, now + 0.02)
    }
    this.lastP = p
  }

  /** Books every note due before now + LOOKAHEAD. */
  tick(now: number) {
    if (!this.running) return
    if (!this.drone.length && this.sampler.has('bass')) {
      // A low D and A, held for as long as the music plays.
      this.drone = [38, 45].map((midi) => this.sampler.play({ group: 'bass', midi, t: now + 0.05, out: this.bus.drone, attack: 2.5 }))
    }
    if (this.nextTime < now) this.nextTime = now + 0.02
    while (this.nextTime < now + LOOKAHEAD) {
      this.onEighth(this.nextTime, this.eighth)
      this.nextTime += EIGHTH
      this.eighth++
    }
  }

  // ---------- the arrangement, one eighth note at a time ----------

  private index() {
    return ((this.chordIndex % 4) + 4) % 4
  }

  private chord() {
    return PROGRESSIONS[this.mode][this.index()]
  }

  private onEighth(t: number, e: number) {
    const inChord = e % EIGHTHS_PER_CHORD
    const inBar = e % 8
    const bar = Math.floor(e / 8)
    if (inChord === 0) this.changeChord(t)
    const c = this.chord()
    const m = this.mix
    const play = this.sampler.play.bind(this.sampler)
    const human = () => (this.rand() - 0.5) * 0.012
    const vary = (g: number) => g * (0.88 + this.rand() * 0.24)
    const on = (layer: Layer) => m[layer] > 0.01

    // The hero: cellos playing the motif, the louder take once the film has built.
    for (const [start, midi, len] of MOTIF[this.mode][this.index()]) {
      if (start !== inChord) continue
      const dur = len * EIGHTH + 0.3
      play({ group: 'cello', midi, vel: m.hero > 0.85 ? 3 : 1, t, dur, attack: 0.08, release: 1, out: this.bus.hero })
      if (on('double')) play({ group: 'violin', midi: midi + 12, vel: 2, t, dur, attack: 0.12, release: 1.2, out: this.bus.double })
    }

    // Hand drums: a keherwa-like eight, with a push on every second bar.
    if (on('hands')) {
      const low = (muted: boolean) => (s: Sample) => s.drum === 'low' && !!s.muted === muted
      const high = (s: Sample) => s.drum === 'high' && !s.muted
      const pattern: [SampleGroup, number, ((s: Sample) => boolean)?][] = [
        ['frame', 1, low(false)],
        ['darbuka', 0.35],
        ['frame', 0.6, high],
        bar % 2 ? ['frame', 0.6, low(false)] : ['darbuka', 0.45],
        ['frame', 0.7, low(true)],
        ['darbuka', 0.35],
        ['frame', 0.75, high],
        ['darbuka', 0.5],
      ]
      const [group, g, only] = pattern[inBar]
      play({ group, t: t + human(), gain: vary(g), out: this.bus.hands, only })
      if (inBar === 7 && m.hands > 0.6) play({ group: 'darbuka', t: t + EIGHTH / 2 + human(), gain: vary(0.25), out: this.bus.hands })
    }

    // Plucked strings: cellos picking through the chord like a guitar, a bass on beats one and three.
    if (on('pizz')) {
      const tones = [c[2], c[4], c[3], c[2] + 12]
      const pick = [0, 1, 2, 1, 3, 1, 2, 1][inBar]
      play({ group: 'pizz', midi: tones[pick], vel: inBar === 0 ? 2 : 1, t: t + human(), gain: vary(inBar % 2 ? 0.7 : 1), out: this.bus.pizz })
      if (inBar === 0 || inBar === 4) play({ group: 'bassPizz', midi: inBar === 0 ? c[0] : c[1], t, gain: vary(1), out: this.bus.pizz })
    }

    // Jazz colour: vibraphone chords with an added ninth, hi-hat on two and four, a shaker.
    if (on('jazz')) {
      const ninth = ((c[0] + 2) % 12) + 72
      if (inChord === 0) [c[2] + 12, c[3] + 12, c[4] + 12, ninth].forEach((n, i) => play({ group: 'vibes', midi: n, t: t + i * 0.045, gain: vary(0.55), out: this.bus.jazz }))
      if (inChord === 10) [c[3] + 12, ninth].forEach((n, i) => play({ group: 'vibes', midi: n, t: t + i * 0.06, gain: vary(0.4), out: this.bus.jazz }))
      if (inBar === 2 || inBar === 6) play({ group: 'hat', t: t + human(), gain: vary(0.6), out: this.bus.jazz })
      if (inBar % 2 === 1) play({ group: 'shaker', t: t + human(), gain: vary(0.35), out: this.bus.jazz })
    }

    // Timpani: a roll swelling into each new chord, and a stroke on its downbeat.
    if (on('timp')) {
      const next = PROGRESSIONS[this.mode][(this.index() + 1) % 4]
      if (inChord === 12) play({ group: 'timp', midi: drum(next[0]), t, dur: 4 * EIGHTH, attack: 4 * EIGHTH, release: 0.15, gain: 0.8, out: this.bus.timp, only: (s) => !!s.roll })
      if (inChord === 0) play({ group: 'timp', midi: drum(c[0]), t, gain: vary(0.9), out: this.bus.timp, only: timpStroke })
    }

    // The release: big drums on the downbeats.
    if (on('big')) {
      if (inBar === 0 || inBar === 4) play({ group: 'kick', vel: inChord === 0 ? 7 : 5, t, gain: vary(1), out: this.bus.big })
      if (inBar === 0 || inBar === 3 || inBar === 6) play({ group: 'frame', t: t + human(), gain: vary(0.9), out: this.bus.big, only: lowDrum })
      if (inChord === 0 || inChord === 8) play({ group: 'timp', midi: drum(c[0]), vel: 4, t, gain: 1, out: this.bus.big, only: timpStroke })
    }
  }

  /** Each new chord: the held strings and horns move to it, the old chord fading under the new. */
  private changeChord(t: number) {
    this.chordIndex++
    const c = this.chord()
    for (const v of this.pads) v.stop(t, 1.8)
    const hold = (group: SampleGroup, midi: number, out: GainNode, vel: number) => this.sampler.play({ group, midi, vel, t, attack: 0.7, out })
    this.pads = [
      ...[c[2], c[3], c[4]].map((n) => hold('viola', n, this.bus.viola, 1)),
      ...[c[3] + 12, c[4] + 12].map((n) => hold('violin', n, this.bus.violin, 1)),
      ...[c[0] + 12, c[1] + 12].map((n) => hold('horn', n, this.bus.horn, 2)),
    ]
  }

  // ---------- hits at the transitions ----------

  private hit(cue: Cue, t: number) {
    const c = this.chord()
    const out = this.bus.hits
    const play = this.sampler.play.bind(this.sampler)
    switch (cue.kind) {
      case 'riser':
      case 'swell': {
        // A suspended-cymbal swell, started so that its peak lands just ahead.
        const lead = cue.kind === 'riser' ? 1.6 : 2.6
        const take = cue.kind === 'riser' ? 'cresc1' : 'cresc0'
        const only = (s: Sample) => s.id === take
        const from = Math.max(0, this.sampler.peakOf('cresc', only) - lead)
        play({ group: 'cresc', t, from, attack: 0.3, dur: lead + 1.2, release: 1.5, gain: cue.kind === 'riser' ? 0.9 : 0.6, out, only })
        return
      }
      case 'shimmer':
        // A vibraphone ripple up through the chord as the white-out fills the frame.
        ;[c[2], c[3], c[4], c[2] + 12, c[3] + 12].forEach((n, i) => play({ group: 'vibes', midi: n + 12, t: t + i * 0.07, gain: 0.55, out }))
        return
      case 'glass':
        // Each landing is a note of the chord, climbing as the structure grows.
        play({ group: 'vibes', midi: c[2 + (cue.index % 3)] + 24, t, gain: 0.5, out })
        return
      case 'lock':
        play({ group: 'timp', midi: drum(c[0]), vel: cue.final ? 4 : 3, t, gain: cue.final ? 1 : 0.8, out, only: timpStroke })
        play({ group: 'frame', t, gain: 0.8, out, only: lowDrum })
        // A short horn chord on every lock.
        ;[c[0] + 12, c[1] + 12, c[2] + 12].forEach((n) => play({ group: 'horn', midi: n, vel: 3, t, dur: 0.55, attack: 0.02, release: 1.2, gain: 0.5, out }))
        if (cue.final) {
          play({ group: 'gong', t, gain: 0.7, out })
          play({ group: 'kick', vel: 7, t, gain: 1, out })
          play({ group: 'cymbal', t: t + 0.01, gain: 0.5, out })
        }
        return
      case 'phone':
        this.phone(t)
        return
      case 'resolve':
        // D major, spelled out on the vibraphone over the low strings.
        ;[62, 66, 69, 74].forEach((n, i) => play({ group: 'vibes', midi: n + 12, t: t + 0.4 + i * 0.32, gain: 0.6, out }))
        play({ group: 'viola', midi: 50, t, dur: 6, attack: 1.5, release: 3, gain: 0.5, out })
        return
    }
  }

  /** 11:47 PM: three short buzzes, quiet, as if from the next room. */
  private phone(t: number) {
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.36
      const o = this.ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 160
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 380
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.04, start + 0.02)
      g.gain.setValueAtTime(0.04, start + 0.16)
      g.gain.linearRampToValueAtTime(0, start + 0.19)
      o.connect(lp).connect(g).connect(this.bus.hits)
      o.start(start)
      o.stop(start + 0.22)
    }
  }

  // ---------- plumbing ----------

  suspend() {
    return (this.ctx as AudioContext).suspend()
  }

  resume() {
    return (this.ctx as AudioContext).resume()
  }

  /** A long, darkening hall: noise that decays and loses its top end over time. */
  private hall(seconds: number) {
    const rate = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(2, rate * seconds, rate)
    const rand = seeded(3)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < data.length; i++) {
        const k = i / data.length
        // A one-pole lowpass that closes as the tail goes on: high frequencies die first.
        const coeff = 0.15 + 0.8 * k
        lp = lp * coeff + (rand() * 2 - 1) * (1 - coeff)
        data[i] = lp * Math.pow(1 - k, 2.2) * 2.5
      }
    }
    return buf
  }
}

/** Timpani sit low: bring any root into the drums' range (A1 to E2). */
function drum(midi: number) {
  let n = midi
  while (n > 40) n -= 12
  while (n < 33) n += 12
  return n
}
