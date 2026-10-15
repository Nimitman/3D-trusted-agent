import { SAMPLES, type Sample, type SampleGroup } from './samples'

/** Fetches one sample's encoded audio by id. */
export type Fetcher = (id: string) => Promise<ArrayBuffer>

type Loaded = {
  buffer: AudioBuffer
  /** Where the note starts in the decoded buffer: codecs may add a little silence in front. */
  offset: number
  /** Time of the loudest moment after the onset (where a cymbal swell peaks). */
  peak: number
}

export type Voice = { stop: (at: number, release: number) => void }

export type NoteOptions = {
  group: SampleGroup
  /** When to start, on the audio clock. */
  t: number
  out: AudioNode
  midi?: number
  vel?: number
  gain?: number
  /** Seconds to hold; omit to hold until stop() is called. */
  dur?: number
  attack?: number
  release?: number
  /** Start this many seconds into the sample (after its onset). */
  from?: number
  /** Only consider samples that pass this test (a drum, a roll, one file). */
  only?: (s: Sample) => boolean
}

const silent: Voice = { stop: () => {} }

/** Plays recorded notes: picks the nearest sample, retunes it, loops it if it is sustained. */
export class Sampler {
  private loaded = new Map<string, Loaded>()
  private round = 0

  constructor(private ctx: BaseAudioContext) {}

  async load(groups: SampleGroup[], fetch: Fetcher) {
    await Promise.all(
      SAMPLES.filter((s) => groups.includes(s.group) && !this.loaded.has(s.id)).map(async (s) => {
        try {
          const buffer = await this.ctx.decodeAudioData(await fetch(s.id))
          this.loaded.set(s.id, { buffer, ...measure(buffer) })
        } catch {
          // A sample that fails to load just leaves its notes out.
        }
      }),
    )
  }

  has(group: SampleGroup) {
    return SAMPLES.some((s) => s.group === group && this.loaded.has(s.id))
  }

  /** The loudest point of a sample, in seconds after its onset. */
  peakOf(group: SampleGroup, only?: (s: Sample) => boolean) {
    const s = this.pick(group, undefined, undefined, only)
    return s ? this.loaded.get(s.id)!.peak : 0
  }

  play(o: NoteOptions): Voice {
    const s = this.pick(o.group, o.midi, o.vel, o.only)
    if (!s) return silent
    const { buffer, offset } = this.loaded.get(s.id)!
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    if (o.midi !== undefined && s.midi !== undefined) src.playbackRate.value = Math.pow(2, (o.midi - s.midi) / 12)
    if (s.loop) {
      src.loop = true
      src.loopStart = offset + s.loop[0]
      src.loopEnd = offset + s.loop[1]
    }
    const g = ctx.createGain()
    const level = o.gain ?? 1
    const attack = o.attack ?? 0.005
    g.gain.setValueAtTime(0, o.t)
    g.gain.linearRampToValueAtTime(level, o.t + attack)
    src.connect(g).connect(o.out)
    src.start(o.t, offset + (o.from ?? 0))

    let stopped = false
    const stop = (at: number, release: number) => {
      if (stopped) return
      stopped = true
      const from = Math.max(at, o.t + attack)
      // Anchor the level first: a fade that follows a ramp directly is computed wrongly by some engines.
      g.gain.setValueAtTime(level, from)
      g.gain.setTargetAtTime(0, from, release / 4)
      src.stop(from + release * 1.5)
    }
    if (o.dur !== undefined) stop(o.t + o.dur, o.release ?? 0.3)
    else if (!s.loop) src.stop(o.t + buffer.duration + 0.1)
    return { stop }
  }

  /** The best loaded sample: the right velocity layer if it has one, then the nearest pitch. */
  private pick(group: SampleGroup, midi?: number, vel?: number, only?: (s: Sample) => boolean) {
    const pool = SAMPLES.filter((s) => s.group === group && this.loaded.has(s.id) && (!only || only(s)))
    if (!pool.length) return undefined
    const layer = vel !== undefined && pool.some((s) => s.vel === vel) ? pool.filter((s) => s.vel === vel) : pool
    if (midi === undefined || layer[0].midi === undefined) {
      // Unpitched: alternate between the takes, so repeated hits never sound identical.
      return layer[this.round++ % layer.length]
    }
    return layer.reduce((best, s) => (Math.abs(s.midi! - midi) < Math.abs(best.midi! - midi) ? s : best))
  }
}

/** Finds a decoded sample's onset and its loudest moment. */
function measure(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  let max = 0
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]))
  const threshold = Math.max(0.004, max * 0.02)
  let start = 0
  while (start < data.length && Math.abs(data[start]) < threshold) start++
  const offset = Math.max(0, start / rate - 0.01)

  const block = 2048
  let loudest = 0
  let at = 0
  for (let i = start; i + block < data.length; i += block) {
    let sum = 0
    for (let j = i; j < i + block; j++) sum += data[j] * data[j]
    if (sum > loudest) {
      loudest = sum
      at = i + block / 2
    }
  }
  return { offset, peak: Math.max(0, at / rate - offset) }
}
