import { useEffect, useMemo, useRef } from 'react'
import { useFilm } from '../state/store'
import { activeWorld, localT } from '../story/timeline'
import { COPY } from '../story/copy'
import { CH03_BEATS, WHITEOUT } from '../story/ch03'
import { CH04_BEATS, CH04_PIECES, landing } from '../story/ch04'
import { CH05_BEATS, LOCK_GROUPS, seatTime } from '../story/ch05'
import { CH06_BEATS } from '../story/ch06'
import { CH07_BEATS } from '../story/ch07'
import { clamp, easeOutCubic, remap, seeded, smoothstep, window4 } from '../lib/math'
import { centroidOf, EXPLODED, OUTLINES, outlineOf, outlineToPath } from '../three/geometry/keystone'

const toSvg = (x: number, y: number): [number, number] => [x * 100, -y * 100]
const STONES = [OUTLINES.plinth, OUTLINES.pierL, OUTLINES.pierR, ...OUTLINES.voussoirs].map((o) => outlineToPath(o, toSvg))
const OPENING = `M -62 0 L -62 -105 A 62 62 0 0 1 62 -105 L 62 0 Z`

/** With reduced motion the film moves in held steps that crossfade, never zooms. */
const quantise = (t: number, steps: number[]) => steps.find((s) => t <= s) ?? 1
const STEPS = {
  ch01: [0.05, 0.4, 0.66, 0.8, 1],
  ch02: [0.25, 0.5, 0.66, 0.75, 0.86, 1],
  ch03: [0.2, 0.33, 0.45, 0.58, 0.71, 0.88, 1],
  ch04: [0.26, 0.34, 0.46, 0.59, 0.72, 0.94, 1],
  ch05: [0.2, 0.31, 0.45, 0.59, 0.73, 0.87, 0.97, 1],
}

/**
 * The badge in 2D, for Chapters 04 and 05. Face on, the 3D layout would already
 * read as an arch, so in Chapter 04 it's scattered wider and turned further
 * (the 3D gets that from its close, orbiting camera). Chapter 05 eases every
 * piece back to zero offset, which is the reveal.
 */
const SCATTER = 2.3
const BADGE = LOCK_GROUPS.flatMap((group, g) =>
  group.map((name) => {
    const outline = outlineOf(name)
    const [cx, cy] = centroidOf(outline)
    const e = EXPLODED[name]
    const ch04 = CH04_PIECES.indexOf(name as (typeof CH04_PIECES)[number])
    return {
      name,
      group: g,
      ch04,
      d: outlineToPath(outline, toSvg),
      cx: cx * 100,
      cy: -cy * 100,
      // The keystone waits above its gap rather than scattered.
      tx: name === 'key' ? 0 : e.dx * 100 * SCATTER,
      ty: name === 'key' ? -85 : -e.dy * 100 * SCATTER,
      rot: name === 'key' ? -7 : (-e.rz * 180 * 2.4) / Math.PI,
    }
  }),
)
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

type FlatFigure = { x: number; y: number; s: number; fate: string; o: number; thread: boolean }

/** A field of figures in simple perspective: far rows small and high, near rows large and low. */
function makeField(): FlatFigure[] {
  const rnd = seeded(5)
  const solid: FlatFigure[] = [
    [640, 0.42],
    [930, 0.48],
    [520, 0.3],
    [1080, 0.34],
    [780, 0.22],
    [1010, 0.18],
  ].map(([x, d]) => ({ x, y: 470 + d * 430, s: 0.45 + d * 1.3, fate: 'solid', o: 0.1, thread: true }))
  const others: FlatFigure[] = []
  while (others.length < 74) {
    const d = rnd()
    const x = rnd() * 1600
    if (Math.abs(x - 800) < 60 + d * 120) continue
    const u = rnd()
    const fate = u < 0.3 ? 'dim' : u < 0.64 ? 'ghost' : u < 0.77 ? 'wire' : 'frag'
    const o = clamp(0.62 * (1 - d) + (rnd() - 0.5) * 0.22, 0, 0.64)
    others.push({ x, y: 470 + d * 430, s: 0.45 + d * 1.3, fate, o, thread: d < 0.55 && rnd() < 0.35 })
  }
  return [...others, ...solid].sort((a, b) => a.y - b.y)
}

/**
 * The 2D film: same story, same doorway outline, no WebGL. Used when the GPU
 * can't carry the 3D, when it fails, and for reduced motion.
 */
export function FlatStage() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useFilm((s) => s.reducedMotion)
  const field = useMemo(makeField, [])

  useEffect(() => {
    const apply = (p: number) => {
      const el = ref.current
      if (!el) return
      el.dataset.world = activeWorld(p)

      const t1 = reduced ? quantise(localT(p, 'ch01'), STEPS.ch01) : localT(p, 'ch01')
      el.style.setProperty('--t', t1.toFixed(4))
      el.style.setProperty('--w1', window4(t1, 0.12, 0.22, 0.42, 0.5).toFixed(3))
      el.style.setProperty('--w2', window4(t1, 0.34, 0.44, 0.64, 0.7).toFixed(3))
      el.style.setProperty('--w3', window4(t1, 0.56, 0.66, 0.84, 0.88).toFixed(3))
      el.style.setProperty('--zoom', reduced ? '1' : (1 + Math.pow(remap(t1, 0.62, 0.88), 3) * 7).toFixed(3))

      const t2 = reduced ? quantise(localT(p, 'ch02'), STEPS.ch02) : localT(p, 'ch02')
      el.style.setProperty('--walk', reduced ? '0' : easeOutCubic(remap(t2, 0.12, 0.78)).toFixed(4))
      el.style.setProperty('--d', remap(t2, 0.38, 0.74).toFixed(4))
      el.style.setProperty('--rim', smoothstep(remap(t2, 0.7, 0.8)).toFixed(3))
      el.style.setProperty('--h2', window4(t2, 0.3, 0.38, 0.56, 0.62).toFixed(3))

      const t3 = reduced ? quantise(localT(p, 'ch03'), STEPS.ch03) : localT(p, 'ch03')
      const [e0, e1] = CH03_BEATS.emerge
      el.style.setProperty('--emerge', smoothstep(remap(t3, e0, e1)).toFixed(3))
      el.style.setProperty('--approach', reduced ? '0' : smoothstep(remap(t3, 0.27, CH03_BEATS.enter)).toFixed(4))
      el.style.setProperty('--inside', remap(t3, CH03_BEATS.enter - 0.02, CH03_BEATS.enter + 0.02).toFixed(3))
      const raw3 = localT(p, 'ch03')
      const t4 = reduced ? quantise(localT(p, 'ch04'), STEPS.ch04) : localT(p, 'ch04')
      const white3 = smoothstep(remap(raw3, WHITEOUT[0], WHITEOUT[1]))
      const white4 = 1 - smoothstep(remap(localT(p, 'ch04'), CH04_BEATS.recede[0], CH04_BEATS.recede[1]))
      el.style.setProperty('--white', (activeWorld(p) === 'ch04' ? white4 : white3).toFixed(3))
      CH04_PIECES.forEach((_, i) => {
        const land = landing(i)
        el.style.setProperty(`--g${i}`, smoothstep(remap(t4, land - 0.025, land + 0.02)).toFixed(3))
      })

      const t5 = reduced ? quantise(localT(p, 'ch05'), STEPS.ch05) : localT(p, 'ch05')
      const stone = smoothstep(remap(t5, CH05_BEATS.stone[0], CH05_BEATS.stone[1]))
      const keyIn = smoothstep(remap(t5, CH05_BEATS.keyAppears, CH05_BEATS.keyAppears + 0.04))
      el.style.setProperty('--stone', stone.toFixed(3))
      el.style.setProperty('--keyin', keyIn.toFixed(3))
      // The slow turn of Chapter 04 straightens to face on as the badge assembles.
      el.style.setProperty('--orbit', reduced ? '0' : (remap(t4, 0.18, 1) * (1 - stone)).toFixed(3))
      BADGE.forEach((b, i) => {
        const seat = seatTime(b.name)
        el.style.setProperty(`--a${i}`, easeInOutCubic(remap(t5, seat - CH05_BEATS.travel, seat)).toFixed(3))
      })
      const t6 = localT(p, 'ch06')
      el.style.setProperty('--quiet', smoothstep(remap(t6, CH06_BEATS.quiet[0], CH06_BEATS.quiet[1])).toFixed(3))
      const t7 = localT(p, 'ch07')
      // The 2D stones are pale; dim them so the final statement reads over them.
      el.style.setProperty('--dim7', smoothstep(remap(t7, CH07_BEATS.start, CH07_BEATS.profession[1])).toFixed(3))
      el.style.setProperty('--push', reduced ? '0' : Math.pow(smoothstep(remap(t7, CH07_BEATS.push[0], CH07_BEATS.push[1])), 2).toFixed(4))
      const [fa, fb, fc, fd] = CH06_BEATS.field
      el.style.setProperty('--field', window4(t6, fa, fb, fc, fd).toFixed(3))

      CH05_BEATS.locks.forEach((lock, g) => {
        const flash = t5 >= lock ? Math.exp(-(t5 - lock) / 0.016) : 0
        // The keystone keeps its glow; the others only flash.
        const keep = g === 4 ? smoothstep(remap(t5, lock - 0.01, lock + 0.03)) * 0.55 : 0
        el.style.setProperty(`--f${g}`, Math.max(flash, keep).toFixed(3))
      })

      CH03_BEATS.moments.forEach(([a, b], i) => {
        const span = b - a
        el.style.setProperty(`--m${i + 1}`, window4(t3, a - 0.01, a + span * 0.12, b - span * 0.1, b + 0.005).toFixed(3))
        el.style.setProperty(`--mt${i + 1}`, remap(t3, a, b).toFixed(3))
      })
    }
    apply(useFilm.getState().p)
    return useFilm.subscribe((s) => apply(s.p))
  }, [reduced])

  return (
    <div ref={ref} className={`flat${reduced ? ' flat--still' : ''}`} aria-hidden="true">
      <div className="flat__world flat__world--ch01">
        <div className="flat__glow" />
        <svg className="flat__arch" viewBox="-140 -240 280 270">
          <path className="flat__opening" d={OPENING} />
          {STONES.map((d, i) => (
            <path key={i} d={d} className="flat__stone" />
          ))}
        </svg>
        <span className="flat__w flat__w1">{COPY.ch01.words[0]}</span>
        <span className="flat__w flat__w2">{COPY.ch01.words[1]}</span>
        <span className="flat__w flat__w3">
          <small>{COPY.ch01.words[2].split(' ')[0]}</small> {COPY.ch01.words[2].split(' ')[1]}
        </span>
      </div>

      <div className="flat__world flat__world--ch02">
        <svg className="crowd" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
          <defs>
            <symbol id="flat-figure" viewBox="-14 -66 28 66" overflow="visible">
              <ellipse cx="0" cy="-58" rx="5.6" ry="6.4" />
              <path d="M-4 -50 L4 -50 L11 -45 Q12 -30 8 -26 Q9 -14 6 0 L-6 0 Q-9 -14 -8 -26 Q-12 -30 -11 -45 Z" />
            </symbol>
          </defs>
          {field.map((f, i) => (
            <g
              key={i}
              className={`fig fig--${f.fate}`}
              style={{ ['--o' as string]: f.o, transform: `translate(${f.x}px, ${f.y}px) scale(${f.s * 1.9})` }}
            >
              {f.thread && (
                <g className="fig__thread">
                  <line x1="0" y1="-66" x2="0" y2="-150" />
                  <rect x="-9" y="-162" width="18" height="10" />
                </g>
              )}
              <use href="#flat-figure" x="-14" y="-66" width="28" height="66" />
            </g>
          ))}
        </svg>
        <div className="flat__h2" key="h2">
          {COPY.ch02.headline.split(' trust ')[0]} trust
          <br />
          {COPY.ch02.headline.split(' trust ')[1]}
        </div>
      </div>

      <div className="flat__world flat__world--ch03">
        <svg className="tower" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <g className="tower__body">
            {Array.from({ length: 12 }, (_, i) => {
              const y = 820 - (i + 1) * 46
              const lit = i === 4
              return (
                <g key={i}>
                  <rect x="560" y={y} width="480" height="40" className={lit ? 'tower__lit' : 'tower__dark'} />
                  <rect x="560" y={y + 40} width="480" height="6" className="tower__slab" />
                </g>
              )
            })}
            {Array.from({ length: 20 }, (_, i) => (
              <line key={i} x1={572 + i * 24} x2={572 + i * 24} y1="268" y2="820" className="tower__mullion" />
            ))}
          </g>
        </svg>
        <div className="fogbank" />
        <div className="whiteout" />
        <div className="moments">
          <Moment n={1}>
            <rect x="300" y="300" width="200" height="90" className="m__plinth" />
            <rect x="285" y="292" width="230" height="10" className="m__tablet" />
            <g className="m__house" transform="translate(400 292)">
              <rect x="-32" y="-34" width="64" height="34" />
              <path d="M-38 -34 L0 -62 L38 -34 Z" />
            </g>
            <circle cx="418" cy="-14" r="18" className="m__flaw" transform="translate(0 292)" />
            <use href="#flat-figure" x="190" y="210" width="52" height="124" className="m__agent" />
            <use href="#flat-figure" x="560" y="215" width="52" height="124" className="m__other" />
          </Moment>
          <Moment n={2}>
            <rect x="250" y="300" width="90" height="70" className="m__plinth" />
            <rect x="460" y="300" width="90" height="70" className="m__plinth" />
            <g className="m__house" transform="translate(295 300)">
              <rect x="-30" y="-32" width="60" height="32" />
              <path d="M-36 -32 L0 -58 L36 -32 Z" />
            </g>
            <g className="m__house m__house--fading" transform="translate(505 300)">
              <rect x="-30" y="-32" width="60" height="32" />
              <path d="M-36 -32 L0 -58 L36 -32 Z" />
            </g>
            <use href="#flat-figure" x="372" y="246" width="52" height="124" className="m__agent m__agent--step" />
            <use href="#flat-figure" x="590" y="250" width="52" height="124" className="m__other" />
          </Moment>
          <Moment n={3}>
            <circle cx="120" cy="352" r="70" className="m__lamp" />
            <path d="M330 370 L760 370 L760 392 L330 380 Z" className="m__shadow" />
            <rect x="318" y="270" width="26" height="100" className="m__ask" />
            <rect x="420" y="296" width="26" height="74" className="m__model" />
            <use href="#flat-figure" x="170" y="246" width="52" height="124" className="m__other" />
            <use href="#flat-figure" x="232" y="252" width="52" height="124" className="m__agent" />
          </Moment>
          <Moment n={4}>
            <rect x="420" y="120" width="300" height="160" className="m__window" />
            <use href="#flat-figure" x="230" y="226" width="56" height="134" className="m__agent" />
            <circle cx="266" cy="296" r="14" className="m__phone" />
            <use href="#flat-figure" x="640" y="250" width="30" height="72" className="m__other m__other--far" />
            <line x1="655" y1="322" x2="262" y2="362" className="m__call" pathLength={1} />
          </Moment>
        </div>
      </div>

      <div className="flat__world flat__world--ch04">
        <div className="stories-bg">
          {Array.from({ length: 28 }, (_, i) => ({ i, left: (i * 37) % 92, top: (i * 53) % 94 }))
            // Upper half only, and off the centre line: the stories surface below the badge.
            .filter(({ left, top }) => top < 50 && !(left > 22 && left < 70 && top > 18))
            .map(({ i, left, top }) => (
              <span key={i} style={{ left: `${left}%`, top: `${top}%`, fontSize: `${12 + ((i * 7) % 9)}px` }}>
                “{COPY.ch06.stories[i % COPY.ch06.stories.length]}”
              </span>
            ))}
        </div>
        <div className="overhead" />
        <GlassField />
        <div className="whiteout" />
      </div>
    </div>
  )
}

/** The badge in 2D: glass in Chapter 04, stone assembling in Chapter 05. */
export function GlassField() {
  return (
    <svg className="glass" viewBox="-170 -260 340 300" preserveAspectRatio="xMidYMid meet">
      {BADGE.map((b, i) => {
        // Chapter 04's pieces appear one by one; the plinth arrives with the stone, the keystone last.
        const show = b.ch04 >= 0 ? `var(--g${b.ch04})` : b.name === 'key' ? 'var(--keyin)' : 'var(--stone)'
        return (
          <g
            key={b.name}
            className={`glass__piece glass__piece--g${b.group}`}
            style={{
              ['--g' as string]: show,
              ['--a' as string]: `var(--a${i})`,
              ['--tx' as string]: b.tx,
              ['--ty' as string]: b.ty,
              ['--rot' as string]: b.rot,
              ['--flash' as string]: `var(--f${b.group})`,
              transformOrigin: `${b.cx}px ${b.cy}px`,
            }}
          >
            <path d={b.d} className="glass__glass" />
            <path d={b.d} className="glass__stone" />
            <circle cx={b.cx} cy={b.cy} r="6" className="glass__ember" />
          </g>
        )
      })}
    </svg>
  )
}

/** One Chapter 03 moment in 2D: a pool of tungsten light and a few shapes. */
function Moment({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <svg className={`moment moment--${n}`} viewBox="0 0 800 450" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="400" cy="372" rx="330" ry="70" className="m__pool" />
      {children}
    </svg>
  )
}
