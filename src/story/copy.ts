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
    // Buttons are off the lockup for now (they interrupted scrolling on); kept for later.
    primary: 'Explore Trusted Agents',
    secondary: 'See how trust is earned',
  },
  /**
   * After the film: what each part of the badge stands for. Draft wording;
   * the product team must confirm the dimensions and how they're described.
   * No scores or metrics: none are backed by real product data yet.
   */
  proof: {
    heading: 'What makes an agent trusted?',
    intro: 'Five qualities, built up over time. Each one holds up the others, and the badge only stands when all five are in place.',
    draft: 'Draft wording · to confirm with product',
    dimensions: [
      {
        id: 'verification',
        part: 'Plinth',
        lock: 'Verified',
        title: 'Property verification',
        line: 'Listings are checked against the actual property.',
        role: 'Everything else stands on it.',
      },
      {
        id: 'responsiveness',
        part: 'Left pier',
        lock: 'Responsive',
        title: 'Responsiveness',
        line: 'Replies when buyers and sellers need an answer.',
        role: 'One of the two sides that carry the weight.',
      },
      {
        id: 'quality',
        part: 'Right pier',
        lock: 'Quality',
        title: 'Listing quality',
        line: 'Accurate details, real photos, honest descriptions.',
        role: 'The other side. Without both, nothing spans.',
      },
      {
        id: 'consistency',
        part: 'The ring of stones',
        lock: 'Consistent',
        title: 'Consistency',
        line: 'The same standard on every listing, over time.',
        role: 'Many small stones, each the same, holding the curve.',
      },
      {
        id: 'behaviour',
        part: 'Keystone',
        lock: 'Trusted',
        title: 'Professional behaviour',
        line: 'Doing the right thing, including when it costs the deal.',
        role: 'Set last. It locks the rest in place.',
      },
    ],
    back: 'Back to the start',
  },
} as const
