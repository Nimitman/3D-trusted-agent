import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useFilm } from '../state/store'
import { COPY } from '../story/copy'
import { LOCK_GROUPS } from '../story/ch05'
import { outlineOf, outlineToPath, type PieceName } from '../three/geometry/keystone'

// three.js only loads for viewers on a 3D tier, and only once this section is near.
const BadgeModel3D = lazy(() => import('./BadgeModel3D'))

const toSvg = (x: number, y: number): [number, number] => [x * 100, -y * 100]

/** The same badge in 2D: the selected part lifts and glows, the rest step back. */
function BadgeModel2D({ active }: { active: number }) {
  return (
    <svg className="proof__svg" viewBox="-150 -250 300 290" aria-hidden="true">
      {LOCK_GROUPS.map((names, g) => (
        <g key={g} className={`proof__part proof__part--g${g}${g === active ? ' is-on' : active >= 0 ? ' is-off' : ''}`}>
          {names.map((n: PieceName) => (
            <path key={n} d={outlineToPath(outlineOf(n), toSvg)} />
          ))}
        </g>
      ))}
    </svg>
  )
}

/**
 * After the film: what each part of the badge stands for. The film has just
 * shown the badge being built; this names what each piece means, plainly,
 * with no scores. Reached by scrolling on, or by "See how trust is earned".
 */
export function HowTrustIsEarned() {
  const tier = useFilm((s) => s.tier)
  const [active, setActive] = useState(0)
  const [near, setNear] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const proof = COPY.proof

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '50% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const toStart = () => {
    const lenis = (window as unknown as { lenis?: { scrollTo: (t: number, o?: object) => void } }).lenis
    if (lenis) lenis.scrollTo(0, { duration: 2.2 })
    else window.scrollTo({ top: 0 })
  }

  return (
    <section ref={ref} id="how-trust-is-earned" className="proof" aria-labelledby="proof-heading" tabIndex={-1}>
      <div className="proof__inner">
        <header className="proof__head">
          <p className="proof__draft">{proof.draft}</p>
          <h2 id="proof-heading" className="proof__heading">
            {proof.heading}
          </h2>
          <p className="proof__intro">{proof.intro}</p>
        </header>

        <div className="proof__grid">
          <div className="proof__model">
            {tier !== 'flat' && near ? (
              <Suspense fallback={<BadgeModel2D active={active} />}>
                <BadgeModel3D active={active} />
              </Suspense>
            ) : (
              <BadgeModel2D active={active} />
            )}
            <p className="proof__part-name" aria-hidden="true">
              {proof.dimensions[active].part}
            </p>
          </div>

          <ol className="proof__list">
            {proof.dimensions.map((d, i) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={`proof__item${i === active ? ' is-on' : ''}`}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                >
                  <span className="proof__lock">{d.lock}</span>
                  <span className="proof__title">{d.title}</span>
                  <span className="proof__line">{d.line}</span>
                  <span className="proof__role">
                    {d.part}. {d.role}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <footer className="proof__foot">
          <button type="button" className="proof__back" onClick={toStart}>
            ↑ {proof.back}
          </button>
          <span className="proof__brand">{COPY.ch07.lockup} · {COPY.ch07.recognised}</span>
        </footer>
      </div>
    </section>
  )
}
