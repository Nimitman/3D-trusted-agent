import { COPY } from './copy'

/**
 * The whole film as plain, ordered HTML. Screen readers, search engines and
 * anyone without the 3D get the same story. Visually hidden; the stage is
 * aria-hidden so the narrative is only announced once.
 */
export function StoryText() {
  return (
    <article id="story" className="sr-only" tabIndex={-1} aria-label="The film, told in text">
      <h1>Trusted Agent, recognised by Housing.com</h1>

      <section aria-labelledby="s1">
        <h2 id="s1">{COPY.ch01.words.join(' ')}</h2>
        <p>A single point of light in the dark becomes a doorway.</p>
      </section>

      <section aria-labelledby="s2">
        <h2 id="s2">{COPY.ch02.headline}</h2>
        {COPY.ch02.beats.map((b) => (
          <p key={b}>{b}</p>
        ))}
      </section>

      <section aria-labelledby="s3">
        <h2 id="s3">The moments that matter</h2>
        {COPY.ch03.moments.map((m) => (
          <p key={m.line}>
            {m.scene} “{m.line}”
          </p>
        ))}
      </section>

      <section aria-labelledby="s4">
        <h2 id="s4">{COPY.ch04.headline}</h2>
      </section>

      <section aria-labelledby="s5">
        <h2 id="s5">{COPY.ch05.result}</h2>
        <p>The badge is built in five parts: {COPY.ch05.locks.join(', ')}.</p>
      </section>

      <section aria-labelledby="s6">
        <h2 id="s6">{COPY.ch06.lines.join(' ')}</h2>
        {/* Sample stories until real, consented quotes exist. */}
        <ul aria-label="What people said (sample copy)">
          {COPY.ch06.stories.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="s7">
        <h2 id="s7">{COPY.ch07.statement.join(' ')}</h2>
        <p>
          {COPY.ch07.lockup}. {COPY.ch07.recognised}. {COPY.ch07.sub.join(' ')}
        </p>
      </section>
    </article>
  )
}
