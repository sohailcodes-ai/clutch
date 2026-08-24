// Fictional product data used to render the Clutch preview experience.

export const NAV_LINKS = [
  { label: 'Arena', href: '#arena' },
  { label: 'Ladder', href: '#ladder' },
  { label: 'Stacks', href: '#stacks' },
  { label: 'Season', href: '#season' },
] as const

export const HERO_STATS = [
  { value: 128, label: 'active duels', detail: 'global queue' },
  { value: 42, label: 'sec median match', detail: 'same-stack band' },
  { value: 1847, label: 'rating swing', detail: 'resolved today' },
] as const

export const MATCH_PHASES = [
  { label: 'Queue', state: 'complete', offset: '00:00' },
  { label: 'Matched', state: 'complete', offset: '00:19' },
  { label: 'Solve', state: 'active', offset: '08:42' },
  { label: 'Verdict', state: 'pending', offset: '--:--' },
] as const

export const LIVE_MATCH = {
  id: 'CL-7F39',
  stack: 'TypeScript',
  problem: 'Streaming median under churn',
  clockStartSeconds: 8 * 60 + 42,
  totalSeconds: 15 * 60,
  players: [
    {
      handle: 'VOID',
      elo: 2841,
      region: 'EU-W',
      progress: 0.72,
      verdicts: ['pass', 'pass', 'fail', 'pending'],
    },
    {
      handle: 'AKIRA',
      elo: 2817,
      region: 'AP-N',
      progress: 0.64,
      verdicts: ['pass', 'fail', 'pending', 'pending'],
    },
  ],
} as const

export const ARENA_STEPS = [
  {
    index: '01',
    title: 'Declare your stack',
    body: 'Queue where you have real fluency. Clutch separates language ratings so a specialist is not flattened into one universal score.',
    metric: 'per-stack MMR',
  },
  {
    index: '02',
    title: 'Enter a rating band',
    body: 'Matchmaking narrows by stack, rating, latency, and recent form before opening a one-versus-one room.',
    metric: 'same-band pairing',
  },
  {
    index: '03',
    title: 'Race the same problem',
    body: 'Both players receive the same prompt, hidden tests, public clock, and visible pressure signals.',
    metric: 'shared clock',
  },
  {
    index: '04',
    title: 'Lock the verdict',
    body: 'Correctness decides first. Time, memory, and elegance break ties only after the solution survives the judge.',
    metric: 'rated outcome',
  },
] as const

export const GLOBAL_RANKS = [
  {
    rank: 1,
    handle: 'VOID',
    elo: 2941,
    delta: 24,
    stack: 'C++',
    form: 'WWLWW',
    momentum: 0.91,
  },
  {
    rank: 2,
    handle: 'AKIRA',
    elo: 2903,
    delta: 11,
    stack: 'Rust',
    form: 'WLWWW',
    momentum: 0.86,
  },
  {
    rank: 3,
    handle: 'NEX',
    elo: 2877,
    delta: -8,
    stack: 'Go',
    form: 'LWWLW',
    momentum: 0.78,
  },
  {
    rank: 4,
    handle: 'SOHAIL',
    elo: 2871,
    delta: 32,
    stack: 'TS',
    form: 'WWWWW',
    momentum: 0.96,
  },
  {
    rank: 5,
    handle: 'MERIDIAN',
    elo: 2844,
    delta: -3,
    stack: 'Python',
    form: 'WWLLW',
    momentum: 0.69,
  },
  {
    rank: 6,
    handle: 'HALCYON',
    elo: 2810,
    delta: 6,
    stack: 'Java',
    form: 'WLWLW',
    momentum: 0.64,
  },
] as const

export const STACKS = [
  {
    name: 'TypeScript',
    symbol: 'TS',
    elo: 1920,
    tier: 'Diamond',
    matches: 361,
    hue: 'gold',
    identity: 'frontend systems, async control, type pressure',
  },
  {
    name: 'Python',
    symbol: 'PY',
    elo: 1701,
    tier: 'Platinum',
    matches: 188,
    hue: 'cyan',
    identity: 'data transforms, graph search, fast iteration',
  },
  {
    name: 'Rust',
    symbol: 'RS',
    elo: 1386,
    tier: 'Gold',
    matches: 42,
    hue: 'red',
    identity: 'memory models, low-level constraints, ownership',
  },
  {
    name: 'C++',
    symbol: 'C+',
    elo: 2044,
    tier: 'Master',
    matches: 214,
    hue: 'green',
    identity: 'performance ceilings, templates, tight runtime',
  },
] as const

export const STACK_ELO_CEILING = 2400

export const SEASON = {
  name: 'Season 04',
  title: 'Pressure Ledger',
  daysRemaining: 89,
  progress: 0.62,
  rules: [
    { label: 'Placement', value: '5 duels' },
    { label: 'Decay', value: '14 idle days' },
    { label: 'Reset', value: 'soft -20%' },
    { label: 'Archive', value: 'peak rank' },
  ],
} as const
