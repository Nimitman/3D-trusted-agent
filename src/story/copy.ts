/**
 * Every line of the film, in order. The 3D scenes, the 2D fallback and the
 * screen-reader narrative all read from here, so the story only exists once.
 */
export const COPY = {
  ch01: { words: ['Everyone', 'can be', 'an agent.'] },
  ch02: {
    headline: 'But trust is different.',
    beats: ["You don't claim it.", "You don't buy it.", 'You earn it.'],
  },
  ch03: {
    moments: [
      { line: "There's something you should know.", scene: 'The agent points out a flaw in the listing before the buyer finds it.' },
      { line: "This one isn't right for you.", scene: 'The agent steers the buyer away from a home that does not fit.' },
      { line: 'You could ask more. But you may wait longer.', scene: 'The agent gives the seller an honest price.' },
      { line: "I'm listening.", scene: 'Late at night, the agent answers a buyer’s call.', stamp: '11:47 PM' },
    ],
  },
  ch04: { headline: 'Trust is built in small moments.' },
  ch05: {
    locks: ['Verified', 'Responsive', 'Quality', 'Consistent', 'Trusted'],
    result: 'Trusted Agent',
  },
  ch06: {
    // Placeholder lines. Replace with real, consented customer stories before launch.
    stories: [
      'He told me when I was making a mistake.',
      "She didn't rush us.",
      'He showed us the problem first.',
      'She found us a better option.',
      'He stayed involved after the deal.',
    ],
    lines: ['Some agents close deals.', 'Trusted agents build confidence.'],
  },
  ch07: {
    statement: ['An agent is a profession.', 'Trusted is earned.'],
    lockup: 'Trusted Agent',
    recognised: 'Recognised by Housing.com',
    sub: ['Find properties.', 'Meet agents worth trusting.'],
    primary: 'Explore Trusted Agents',
    secondary: 'See how trust is earned',
  },
} as const
