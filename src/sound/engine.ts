import { arrangementAt, BEAT, CHORD_BEATS, CUES, PROGRESSIONS, type Arrangement, type Cue } from './score'

/**
 * The film's background music, generated live with Web Audio and scheduled on
 * the audio clock. A chord progression plays continuously in real time; scroll
 * position decides the arrangement (which layers are in, minor or major) and
 * fires musical hits at the key transitions. No files, no licensing.
 *
 *   pad     low strings: detuned saws through a soft lowpass, slow swells
 *   pulse   a low eighth-note ostinato on the chord root
 *   piano   sparse felt-piano notes from the chord
 *   high    high strings on the top of the voicing, with gentle vibrato
 *   hits    risers, swells, piano ripples, booms and stabs, into a long reverb
 */

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
/** How far ahead notes are booked, in seconds. */
const LOOKAHEAD = 0.25

type Held = { stop: (at: number, release: number) => void }

export class SoundEngine {
  readonly ctx: AudioContext
  private out: GainNode
  private reverb: ConvolverNode
  private bus: Record<'pad' | 'pulse' | 'piano' | 'high' | 'hits', GainNode>
  private padTone: BiquadFilterNode
  private noise: AudioBuffer

  private mix: Arrangement = arrangementAt(0)
  private chordIndex = -1
  private mode: 'minor' | 'major' = 'minor'
  private nextBeat = 0
  private beat = 0
  private held: Held[] = []
  private timer = 0
  private lastP = -1

  /** Takes a context created and unlocked inside the user's click (see SoundToggle). */
  constructor(ctx: AudioContext) {
    this.ctx = ctx
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.ratio.value = 6
    limiter.attack.value = 0.01
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(limiter).connect(ctx.destination)

    // A long, dark hall: what makes it feel cinematic rather than synthetic.
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.hall(4.8)
    const wet = ctx.createGain()
    wet.gain.value = 0.5
    this.reverb.connect(wet).connect(this.out)

    const bus = (dry: number, send: number) => {
      const g = ctx.createGain()
      g.gain.value = 0
      const d = ctx.createGain()
      d.gain.value = dry
      const s = ctx.createGain()
      s.gain.value = send
      g.connect(d).connect(this.out)
      g.connect(s).connect(this.reverb)
      return g
    }
    this.padTone = ctx.createBiquadFilter()
    this.padTone.type = 'lowpass'
    this.padTone.frequency.value = 900
    this.padTone.Q.value = 0.4
    this.bus = {
      pad: bus(0.7, 0.6),
      pulse: bus(0.85, 0.25),
      piano: bus(0.6, 0.75),
      high: bus(0.5, 0.8),
      hits: bus(0.7, 0.7),
    }
    this.padTone.connect(this.bus.pad)
    this.noise = this.whiteNoise(3)
  }

  /** Fade the whole layer in or out, and start or stop the clock. */
  setOn(on: boolean) {
    const now = this.ctx.currentTime
    this.out.gain.cancelScheduledValues(now)
    this.out.gain.setTargetAtTime(on ? 0.55 : 0, now, on ? 0.8 : 0.3)
    if (on && !this.timer) {
      this.nextBeat = now + 0.1
      this.timer = window.setInterval(() => this.schedule(), 60)
    } else if (!on && this.timer) {
      clearInterval(this.timer)
      this.timer = 0
    }
  }

  /** Called every frame with film progress, scroll speed and how far past the film we are. */
  update(p: number, velocity: number, beyond: number) {
    const now = this.ctx.currentTime
    this.mix = arrangementAt(p)
    const after = 1 - Math.min(1, beyond * 1.5)
    const level = this.mix.master * after
    const set = (g: GainNode, v: number, tc = 0.6) => g.gain.setTargetAtTime(v * level, now, tc)
    set(this.bus.pad, 0.42 * this.mix.pad, 0.9)
    set(this.bus.pulse, 0.5 * this.mix.pulse, 0.5)
    set(this.bus.piano, 0.55 * this.mix.piano, 0.6)
    set(this.bus.high, 0.3 * this.mix.high, 1.2)
    // Hits keep their own dynamics, but respect the silence and the page after the film.
    this.bus.hits.gain.setTargetAtTime(level, now, 0.2)
    // The pad brightens as the story builds, and a little with scroll speed.
    const bright = 700 + this.mix.high * 1400 + Math.min(1, Math.abs(velocity)) * 500
    this.padTone.frequency.setTargetAtTime(bright, now, 0.8)

    // The release: as the keystone seats, change to major at once, not at the next bar.
    if (this.mix.mode !== this.mode) {
      this.mode = this.mix.mode
      this.changeChord(now + 0.05, 0)
    }

    // Hits fire only when passing their moment forwards, and not on a big jump.
    if (this.lastP >= 0 && p > this.lastP && p - this.lastP < 0.02) {
      for (const cue of CUES) if (cue.p > this.lastP && cue.p <= p) this.hit(cue)
    }
    this.lastP = p
  }

  // ---------- the clock ----------

  private schedule() {
    if (this.ctx.state !== 'running') return
    const horizon = this.ctx.currentTime + LOOKAHEAD
    while (this.nextBeat < horizon) {
      this.onBeat(this.nextBeat, this.beat)
      this.nextBeat += BEAT / 2 // eighth notes
      this.beat++
    }
  }

  private chord() {
    const prog = PROGRESSIONS[this.mode]
    return prog[((this.chordIndex % prog.length) + prog.length) % prog.length]
  }

  /** Every eighth note: chord changes, the pulse, and the piano's sparse pattern. */
  private onBeat(t: number, eighth: number) {
    const inChord = eighth % (CHORD_BEATS * 2)
    if (inChord === 0) this.changeChord(t, 1)
    const chord = this.chord()

    // Pulse: steady eighths on the root, an octave up, accented on each beat.
    if (this.mix.pulse > 0.01) this.pluck(t, mtof(chord[0] + 12), eighth % 2 === 0 ? 1 : 0.6)

    // Piano: a few notes per chord, rising through the voicing, never busy.
    const pattern: Record<number, number> = { 0: 2, 3: 3, 6: 4, 10: 3, 13: 4 }
    if (this.mix.piano > 0.01 && inChord in pattern) {
      const note = chord[pattern[inChord]] + 12
      this.piano(t, mtof(note), inChord === 0 ? 0.9 : 0.6)
    }
  }

  /** Move to the next chord: the old one swells away as the new one swells in. */
  private changeChord(t: number, step: number) {
    this.chordIndex += step
    const chord = this.chord()
    for (const h of this.held) h.stop(t, 2.6)
    this.held = []
    for (const m of chord) this.held.push(this.padNote(t, mtof(m)))
    for (const m of chord.slice(-2)) this.held.push(this.highNote(t, mtof(m + 12)))
  }

  // ---------- instruments ----------

  /** Low strings: two detuned saws and a sine, slow attack, long release. */
  private padNote(t: number, f: number): Held {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.06, t + 2.2)
    g.connect(this.padTone)
    const oscs = [
      { type: 'sawtooth' as OscillatorType, detune: -8 },
      { type: 'sawtooth' as OscillatorType, detune: 7 },
      { type: 'sine' as OscillatorType, detune: 0 },
    ].map(({ type, detune }) => {
      const o = this.ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = detune
      o.connect(g)
      o.start(t)
      return o
    })
    return {
      stop: (at, release) => {
        g.gain.cancelScheduledValues(at)
        g.gain.setTargetAtTime(0, at, release / 4)
        oscs.forEach((o) => o.stop(at + release * 1.5))
      },
    }
  }

  /** High strings: a saw ensemble with slow vibrato, swelling in. */
  private highNote(t: number, f: number): Held {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.045, t + 3)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    g.connect(lp).connect(this.bus.high)
    const vibrato = this.ctx.createOscillator()
    vibrato.frequency.value = 4.6
    const depth = this.ctx.createGain()
    depth.gain.value = 6
    vibrato.connect(depth)
    vibrato.start(t)
    const oscs = [-10, 0, 9].map((detune) => {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = detune
      depth.connect(o.detune)
      o.connect(g)
      o.start(t)
      return o
    })
    return {
      stop: (at, release) => {
        g.gain.cancelScheduledValues(at)
        g.gain.setTargetAtTime(0, at, release / 3)
        ;[...oscs, vibrato].forEach((o) => o.stop(at + release * 1.8))
      },
    }
  }

  /** The pulse: a soft low pluck whose brightness falls away quickly. */
  private pluck(t: number, f: number, accent: number) {
    const o = this.ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1600, t)
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.25)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.28 * accent, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38)
    o.connect(lp).connect(g).connect(this.bus.pulse)
    o.start(t)
    o.stop(t + 0.42)
  }

  /** Felt piano: a few decaying partials and a soft hammer, warm rather than bright. */
  private piano(t: number, f: number, velocity: number, bus: GainNode = this.bus.piano) {
    ;[
      [1, 1, 3.4],
      [2, 0.42, 2],
      [3, 0.18, 1.2],
      [4.02, 0.08, 0.7],
    ].forEach(([ratio, amp, decay]) => {
      const o = this.ctx.createOscillator()
      o.frequency.value = f * ratio
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16 * amp * velocity, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(bus)
      o.start(t)
      o.stop(t + decay + 0.05)
    })
    // The felt: a tiny, muffled thump of noise.
    const hammer = this.ctx.createBufferSource()
    hammer.buffer = this.noise
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    const hg = this.ctx.createGain()
    hg.gain.setValueAtTime(0.03 * velocity, t)
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    hammer.connect(lp).connect(hg).connect(bus)
    hammer.start(t, Math.random() * 2, 0.05)
  }

  // ---------- hits at the transitions ----------

  private hit(cue: Cue) {
    const t = this.ctx.currentTime + 0.02
    const chord = this.chord()
    switch (cue.kind) {
      case 'riser':
        return this.riser(t, 1.6)
      case 'swell':
        return this.riser(t, 2.4, true)
      case 'shimmer':
        // A quick piano ripple up through the chord, high and soft.
        return chord.forEach((m, i) => this.piano(t + i * 0.09, mtof(m + 24), 0.45, this.bus.hits))
      case 'glass':
        // Each landing is a note of the chord, climbing as the structure grows.
        return this.piano(t, mtof(chord[2 + (cue.index % 3)] + 24), 0.7, this.bus.hits)
      case 'lock':
        return this.lock(t, chord, cue.final)
      case 'phone':
        return this.phone(t)
      case 'resolve': {
        const d = PROGRESSIONS.major[0]
        d.forEach((m) => this.padNote(t, mtof(m)).stop(t + 7, 4))
        ;[62, 66, 69, 74].forEach((m, i) => this.piano(t + 0.6 + i * 0.32, mtof(m + 12), 0.6, this.bus.hits))
        return
      }
    }
  }

  /** Air rising: filtered noise sweeping up and swelling, cut at the top. */
  private riser(t: number, length: number, soft = false) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(300, t)
    bp.frequency.exponentialRampToValueAtTime(soft ? 2400 : 5200, t + length)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(soft ? 0.12 : 0.2, t + length)
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + (soft ? 1.2 : 0.12))
    src.connect(bp).connect(g).connect(this.bus.hits)
    src.start(t, 0, length + 1.5)
  }

  /** A lock: a deep boom and a low string stab on the chord. Bigger for Trusted. */
  private lock(t: number, chord: readonly number[], final: boolean) {
    const weight = final ? 1.6 : 1
    const boom = this.ctx.createOscillator()
    boom.frequency.setValueAtTime(70, t)
    boom.frequency.exponentialRampToValueAtTime(34, t + 0.6)
    const bg = this.ctx.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.7 * weight, t + 0.01)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 * weight)
    boom.connect(bg).connect(this.bus.hits)
    boom.start(t)
    boom.stop(t + 1.3 * weight)

    for (const m of [chord[0] + 12, chord[1] + 12, chord[2] + 12]) {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = mtof(m)
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2400, t)
      lp.frequency.exponentialRampToValueAtTime(300, t + 0.5)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.07 * weight, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 * weight)
      o.connect(lp).connect(g).connect(this.bus.hits)
      o.start(t)
      o.stop(t + 1 * weight)
    }
    if (final) this.wash(t, 3.5)
  }

  /** A long cymbal-like wash after the big hit: the air opening as the music turns to major. */
  private wash(t: number, length: number) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3800
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + length)
    src.connect(hp).connect(g).connect(this.bus.hits)
    src.start(t, 0, length + 0.1)
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
    return this.ctx.suspend()
  }

  resume() {
    return this.ctx.resume()
  }

  private whiteNoise(seconds: number) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  /** A long, darkening hall: noise that decays and loses its top end over time. */
  private hall(seconds: number) {
    const rate = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(2, rate * seconds, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < data.length; i++) {
        const k = i / data.length
        // A one-pole lowpass that closes as the tail goes on: high frequencies die first.
        const coeff = 0.15 + 0.8 * k
        lp = lp * coeff + (Math.random() * 2 - 1) * (1 - coeff)
        data[i] = lp * Math.pow(1 - k, 2.2) * 2.5
      }
    }
    return buf
  }
}
