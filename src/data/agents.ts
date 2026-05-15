// ─────────────────────────────────────────────────────────────
//  Corporate config
// ─────────────────────────────────────────────────────────────
export const COMPANY_NAME = 'FakeClaw Inc.';
export const PLAYER_INDEX = 0;
export const NPC_START_INDEX = 1;
export const TOTAL_COUNT = 2000;
export const NPC_COUNT = TOTAL_COUNT - 1; // 1999
export const CORE_AGENT_COUNT = 100; // First 100 agents have active wallets

// ─────────────────────────────────────────────────────────────
//  Agent data types
// ─────────────────────────────────────────────────────────────
export type WalletSkill =
  | 'authenticate-wallet'
  | 'fund'
  | 'send-usdc'
  | 'trade'
  | 'pay-for-service'
  | 'search-for-service'
  | 'monetize-service'
  | 'x402';

export interface AgentWallet {
  address: string;            // 0x… Ethereum address on Base / ARC
  skills: WalletSkill[];      // agentic-wallet skills this agent can use
  balance: number;            // USDC balance (display only for NPCs)
  chain: 'base' | 'base-sepolia' | 'arc-testnet';
}

// ─────────────────────────────────────────────────────────────
//  ARC Testnet chain constants
// ─────────────────────────────────────────────────────────────
export const ARC_CHAIN_ID = 5042002;
export const ARC_RPC_BASE = 'https://rpc.testnet.arc-node.thecanteenapp.com/v1';
export const ARC_EXPLORER = 'https://testnet.arcscan.app';
export const ARC_AGENT_START = 2000;   // Indices 2000–2009 are ARC agents
export const ARC_AGENT_COUNT = 10;

export interface AgentData {
  index: number;
  department: string;
  role: string;
  expertise: string[];
  mission: string;
  personality: string;
  isPlayer: boolean;
  color: string;
  
  // Wallet
  wallet: AgentWallet;

  // Trading Profile
  traderPersonality: string;
  tradingStyle: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Degen';
  preferredTokens: string[];
  outfit: string;
}

// ─────────────────────────────────────────────────────────────
//  Corporate Departments & Roles
// ─────────────────────────────────────────────────────────────

interface DepartmentConfig {
  name: string;
  color: string;
  roles: string[];
  expertise: string[][];
  missions: string[];
}

const DEPARTMENTS: DepartmentConfig[] = [
  {
    name: 'Production',
    color: '#22c55e', // Emerald/Green
    roles: [
      'Senior Software Engineer',
      'Frontend Developer',
      'Backend Architect',
      'DevOps Engineer',
      'QA Specialist',
      'Product Manager',
      'UI/UX Designer',
      'Data Scientist',
      'Mobile Lead',
      'Cloud Architect'
    ],
    expertise: [
      ['React', 'TypeScript', 'Node.js'],
      ['Python', 'Kubernetes', 'AWS'],
      ['Rust', 'Systems Programming', 'Performance'],
      ['PostgreSQL', 'Redis', 'System Design'],
      ['Figma', 'Design Systems', 'User Research'],
      ['PyTorch', 'Machine Learning', 'Data Pipelines'],
      ['Swift', 'Kotlin', 'Mobile Architecture'],
      ['CI/CD', 'Terraform', 'Infrastructure'],
      ['Cypress', 'Unit Testing', 'Automation'],
      ['Agile', 'Product Roadmap', 'Stakeholders']
    ],
    missions: [
      'Refactor the legacy authentication microservice',
      'Optimize the real-time data sync pipeline',
      'Implement the new design system across all platforms',
      'Reduce infrastructure costs by 20% this quarter',
      'Achieve 99.9% test coverage for the core API',
      'Launch the beta version of the mobile app',
      'Migrate the database to a multi-region setup',
      'Integrate the new AI recommendation engine',
      'Improve LCP and CLS scores for the landing page',
      'Automate the deployment process for staging environments'
    ]
  },
  {
    name: 'Sales',
    color: '#ef4444', // Red
    roles: [
      'Account Executive',
      'Sales Development Representative',
      'Customer Success Manager',
      'Solutions Architect',
      'Partnership Manager',
      'Sales Operations Lead',
      'Enterprise Sales Director',
      'Technical Sales Engineer',
      'Inside Sales Representative',
      'Channel Partner Manager'
    ],
    expertise: [
      ['CRM', 'Lead Generation', 'Negotiation'],
      ['Customer Retention', 'Upselling', 'Onboarding'],
      ['Technical Demos', 'Cloud Solutions', 'Pre-sales'],
      ['Strategic Partnerships', 'Networking', 'B2B'],
      ['Sales Forecasting', 'Data Analysis', 'Revenue Ops'],
      ['Enterprise Sales', 'Complex Deals', 'C-level Pitch'],
      ['Market Research', 'Competitor Analysis', 'Cold Outreach'],
      ['Contract Negotiation', 'Legal Compliance', 'Pricing'],
      ['Public Speaking', 'Presentations', 'Relationship Building'],
      ['Salesforce', 'HubSpot', 'Outreach.io']
    ],
    missions: [
      'Close the $500k contract with GlobalTech',
      'Increase the renewal rate to 95%',
      'Onboard 50 new mid-market customers this month',
      'Develop a new partnership strategy for the EU market',
      'Optimize the sales funnel conversion rate',
      'Deliver the technical demo for the upcoming RFP',
      'Expand the channel partner network in APAC',
      'Reduce the average sales cycle by 10 days',
      'Launch the new referral program for existing clients',
      'Conduct a win/loss analysis for the last quarter'
    ]
  },
  {
    name: 'Marketing',
    color: '#EF52BA', // Pink/Magenta
    roles: [
      'Content Strategist',
      'Growth Marketer',
      'SEO Specialist',
      'Social Media Manager',
      'Brand Designer',
      'Event Coordinator',
      'Performance Marketing Lead',
      'Copywriter',
      'Public Relations Manager',
      'Email Marketing Specialist'
    ],
    expertise: [
      ['Content Marketing', 'Storytelling', 'Editing'],
      ['A/B Testing', 'Conversion Optimization', 'Analytics'],
      ['SEO', 'SEM', 'Keyword Research'],
      ['Social Media Strategy', 'Community Management', 'Influencers'],
      ['Visual Identity', 'Typography', 'Illustration'],
      ['Event Planning', 'Logistics', 'Budgeting'],
      ['Paid Ads', 'Google Ads', 'Meta Ads'],
      ['Creative Writing', 'Messaging', 'Brand Voice'],
      ['Media Relations', 'Press Releases', 'Crisis Comms'],
      ['Marketing Automation', 'Segmentation', 'Drip Campaigns']
    ],
    missions: [
      'Launch the "Future of IT" brand campaign',
      'Increase organic traffic by 30% via SEO',
      'Organize the FakeClaw Annual Tech Summit',
      'Achieve a 5% click-through rate on the new ad set',
      'Publish the 2026 Industry Trends whitepaper',
      'Grow the LinkedIn community to 100k followers',
      'Redesign the corporate website for better conversion',
      'Secure 5 major media placements for the product launch',
      'Optimize the customer acquisition cost (CAC)',
      'Develop the messaging for the new enterprise tier'
    ]
  },
  {
    name: 'Finance',
    color: '#eab308', // Yellow
    roles: [
      'Financial Controller',
      'Financial Analyst',
      'Accountant',
      'Payroll Manager',
      'Tax Specialist',
      'Treasury Manager',
      'Internal Auditor',
      'Procurement Lead',
      'Investor Relations Manager',
      'FP&A Director'
    ],
    expertise: [
      ['Financial Modeling', 'Budgeting', 'Forecasting'],
      ['GAAP', 'IFRS', 'Financial Reporting'],
      ['Payroll Processing', 'Benefits Admin', 'Compliance'],
      ['Tax Planning', 'Audit Support', 'Corporate Tax'],
      ['Cash Flow Management', 'Risk Assessment', 'Banking'],
      ['Internal Controls', 'SOX Compliance', 'Process Improvement'],
      ['Strategic Sourcing', 'Vendor Management', 'Cost Control'],
      ['Investor Comms', 'Equity Research', 'SEC Filings'],
      ['ERP Systems', 'NetSuite', 'SAP'],
      ['Mergers & Acquisitions', 'Due Diligence', 'Valuation']
    ],
    missions: [
      'Finalize the Q1 financial statements',
      'Reduce operational expenses by 5%',
      'Implement the new automated expense system',
      'Prepare the documentation for the upcoming external audit',
      'Optimize the company\'s tax strategy for 2026',
      'Manage the $10M treasury portfolio',
      'Negotiate better terms with top 10 vendors',
      'Prepare the investor deck for the Series C round',
      'Streamline the payroll process for international employees',
      'Conduct a deep dive into the unit economics of the SaaS model'
    ]
  },
  {
    name: 'People',
    color: '#7C8289',
    roles: ['Chief People Officer'],
    expertise: [['Human Resources', 'Culture', 'Talent Strategy']],
    missions: ['Foster a world-class culture and employee experience']
  }
];

const PERSONALITIES: string[] = [
  'Direct and pragmatic, focused on KPIs',
  'Highly collaborative, always seeking consensus',
  'Analytical and data-driven, skeptical of intuition',
  'Visionary and ambitious, pushes boundaries',
  'Methodical and detail-oriented, follows procedure',
  'Empathetic and supportive, great team player',
  'Results-oriented, thrives under pressure',
  'Creative and unconventional, thinks outside the box'
];

const TRADER_PROFILES = [
  {
    personality: 'Hyper-aggressive degen',
    style: 'High-leverage scalping',
    risk: 'Degen',
    tokens: ['PEPE', 'WIF', 'BONK', 'DOGE'],
    outfits: ['Neon Hoodie', 'Cyberpunk Visor', 'Streetwear']
  },
  {
    personality: 'Conservative institutional',
    style: 'Long-term value investing',
    risk: 'Low',
    tokens: ['BTC', 'ETH', 'SOL'],
    outfits: ['Tailored Suit', 'Luxury Watch', 'Minimalist']
  },
  {
    personality: 'Technical chart wizard',
    style: 'Swing trading based on RSI/MACD',
    risk: 'Medium',
    tokens: ['SOL', 'JUP', 'PYTH', 'LINK'],
    outfits: ['Tech Vest', 'Smart Glasses', 'Cargo Pants']
  },
  {
    personality: 'Chaos-driven contrarian',
    style: 'Shorting the tops, buying the blood',
    risk: 'High',
    tokens: ['ETH', 'LDO', 'PENDLE'],
    outfits: ['Vintage Leather Jacket', 'Combat Boots', 'Distressed Denim']
  },
  {
    personality: 'Meme-lord influencer',
    style: 'Social sentiment momentum',
    risk: 'High',
    tokens: ['DOGE', 'SHIB', 'FLOKI'],
    outfits: ['Bright Tracksuit', 'Gold Chains', 'Designer Sneakers']
  }
];

// ─────────────────────────────────────────────────────────────
//  Wallet helpers
// ─────────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random wallet address per agent index.
 * Uses a simple hash to produce a valid-looking 0x address.
 * The player (index 0) gets a placeholder that is replaced at
 * runtime once they authenticate via `npx awal auth login`.
 */
function generateWalletAddress(index: number): string {
  // Simple deterministic hash → 40 hex chars
  let h = 0x811c9dc5; // FNV offset basis
  const data = `monopolous-agent-${index}`;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // Expand to 40 hex characters (20 bytes) by running multiple rounds
  let hex = '';
  for (let round = 0; round < 5; round++) {
    let v = h ^ (round * 0x9e3779b9);
    v = Math.imul(v, 0x01000193);
    hex += (v >>> 0).toString(16).padStart(8, '0');
  }
  return '0x' + hex.slice(0, 40);
}

/** Assign wallet skills based on department / role. */
function assignWalletSkills(dept: string, riskLevel: string, isPlayer: boolean): WalletSkill[] {
  // Every agent can authenticate and check balance
  const base: WalletSkill[] = ['authenticate-wallet'];

  if (isPlayer) {
    // Player gets all skills
    return [
      'authenticate-wallet', 'fund', 'send-usdc', 'trade',
      'pay-for-service', 'search-for-service', 'monetize-service', 'x402',
    ];
  }

  // NPCs get skills based on department
  switch (dept) {
    case 'Executive':
      return [...base, 'fund', 'send-usdc', 'trade', 'x402'];
    case 'Finance':
      return [...base, 'fund', 'send-usdc', 'trade', 'pay-for-service'];
    case 'Sales':
      return [...base, 'send-usdc', 'pay-for-service', 'search-for-service'];
    case 'Marketing':
      return [...base, 'send-usdc', 'monetize-service', 'x402'];
    case 'Production':
      return [...base, 'trade', 'search-for-service', 'x402'];
    case 'People':
      return [...base, 'send-usdc', 'fund'];
    default:
      return [...base, 'send-usdc'];
  }
}

/** Starting USDC balance per risk level. */
function startingBalance(riskLevel: string): number {
  switch (riskLevel) {
    case 'Degen': return 500;
    case 'High':  return 1000;
    case 'Medium': return 2500;
    case 'Low':   return 5000;
    default:      return 1500;
  }
}

// ─────────────────────────────────────────────────────────────
//  Generation
// ─────────────────────────────────────────────────────────────
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const _agents: AgentData[] = [];

// Index 0: CEO (Player)
const ceoProfile = pick(TRADER_PROFILES, 1); // Institutional
_agents.push({
  index: 0,
  department: 'Executive',
  role: 'CEO',
  expertise: ['Strategy', 'Leadership', 'Vision'],
  mission: 'Lead FakeClaw Inc. to market dominance',
  personality: 'Decisive and inspiring leader',
  isPlayer: true,
  color: '#7EACEA', // Light Blue
  wallet: {
    address: generateWalletAddress(0), // replaced at runtime after auth
    skills: assignWalletSkills('Executive', 'Low', true),
    balance: 10_000,
    chain: 'base',
  },
  traderPersonality: ceoProfile.personality,
  tradingStyle: ceoProfile.style,
  riskLevel: ceoProfile.risk as any,
  preferredTokens: ceoProfile.tokens,
  outfit: pick(ceoProfile.outfits, 0)
});

// Indices 1-99: Employees
const otherDepts = DEPARTMENTS.filter(d => d.name !== 'People');
const peopleDept = DEPARTMENTS.find(d => d.name === 'People')!;

for (let i = 1; i < TOTAL_COUNT; i++) {
  let dept: DepartmentConfig;
  let n: number;
  let roleIdx: number;

  if (i === 1) {
    // Special case: Only one NPC for People department
    dept = peopleDept;
    n = 0;
    roleIdx = 0;
  } else {
    // Distribute the rest among other departments
    n = i - 2;
    dept = otherDepts[n % otherDepts.length];
    roleIdx = Math.floor(n / otherDepts.length) % dept.roles.length;
  }

  const profile = pick(TRADER_PROFILES, i);
  const riskLevel = profile.risk as 'Low' | 'Medium' | 'High' | 'Degen';

  _agents.push({
    index: i,
    department: dept.name,
    role: dept.roles[roleIdx],
    expertise: dept.expertise[roleIdx],
    mission: pick(dept.missions, n),
    personality: pick(PERSONALITIES, n),
    isPlayer: false,
    color: dept.color,
    wallet: {
      address: generateWalletAddress(i),
      skills: assignWalletSkills(dept.name, riskLevel, false),
      balance: startingBalance(riskLevel),
      chain: 'base',
    },
    traderPersonality: profile.personality,
    tradingStyle: profile.style,
    riskLevel: riskLevel,
    preferredTokens: profile.tokens,
    outfit: pick(profile.outfits, i)
  });
}

export const AGENTS: AgentData[] = _agents;

export function getAgent(index: number): AgentData | undefined {
  return _agents[index];
}

// ─────────────────────────────────────────────────────────────
//  ARC Testnet Agents (indices 2000–2009)
//  These agents run on Arc Blockchain testnet (Chain ID 5042002),
//  pay gas in USDC, and do NOT use BankrBot wallets.
// ─────────────────────────────────────────────────────────────

const ARC_ROLES: Array<{
  role: string;
  expertise: string[];
  mission: string;
  personality: string;
  traderPersonality: string;
  tradingStyle: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Degen';
  preferredTokens: string[];
  outfit: string;
  color: string;
}> = [
  {
    role: 'Protocol Architect',
    expertise: ['Layer-2 Scaling', 'USDC Gas Abstraction', 'EVM Compatibility'],
    mission: 'Design the settlement layer for cross-chain USDC flows on Arc testnet',
    personality: 'Methodical systems thinker who obsesses over throughput and finality guarantees',
    traderPersonality: 'Institutional',
    tradingStyle: 'Macro Trend Following',
    riskLevel: 'Low',
    preferredTokens: ['USDC', 'ETH'],
    outfit: 'Sharp navy suit with silver circuit-board cufflinks',
    color: '#6366f1',
  },
  {
    role: 'Chain Validator',
    expertise: ['Node Operation', 'Consensus Mechanisms', 'Arc Testnet RPC'],
    mission: 'Run and monitor Arc testnet validator nodes and report anomalies',
    personality: 'Vigilant guardian who treats uptime as a moral imperative',
    traderPersonality: 'Algo',
    tradingStyle: 'Mean Reversion',
    riskLevel: 'Low',
    preferredTokens: ['USDC'],
    outfit: 'Black turtleneck and noise-cancelling headphones',
    color: '#22d3ee',
  },
  {
    role: 'DeFi Architect',
    expertise: ['AMM Design', 'USDC Liquidity', 'Base Chain Bridges'],
    mission: 'Bootstrap liquidity pools on Arc testnet using USDC from Base chain',
    personality: 'Pragmatic liquidity maximalist who follows capital flows',
    traderPersonality: 'Swing',
    tradingStyle: 'Momentum',
    riskLevel: 'High',
    preferredTokens: ['USDC', 'ETH', 'WETH'],
    outfit: 'Hoodie with "Gas is Free If You Use USDC" print',
    color: '#f59e0b',
  },
  {
    role: 'Bridge Engineer',
    expertise: ['Cross-Chain Messaging', 'CCTP', 'Circle USDC Bridge'],
    mission: 'Implement and stress-test USDC bridges between Base and Arc testnet',
    personality: 'Detail-oriented plumber who lives in transaction receipts',
    traderPersonality: 'Arbitrage',
    tradingStyle: 'Statistical Arbitrage',
    riskLevel: 'Medium',
    preferredTokens: ['USDC', 'ETH'],
    outfit: 'Hard hat and tool belt with USB drives instead of tools',
    color: '#10b981',
  },
  {
    role: 'Smart Contract Auditor',
    expertise: ['Solidity Security', 'Fuzzing', 'Formal Verification'],
    mission: 'Audit all Arc testnet smart contracts before mainnet graduation',
    personality: 'Paranoid perfectionist who finds bugs in their sleep',
    traderPersonality: 'Conservative',
    tradingStyle: 'Value Investing',
    riskLevel: 'Low',
    preferredTokens: ['USDC'],
    outfit: 'White lab coat, red pens everywhere',
    color: '#ef4444',
  },
  {
    role: 'Tokenomics Researcher',
    expertise: ['USDC Gas Mechanics', 'Fee Market Design', 'Incentive Engineering'],
    mission: 'Model and simulate the Arc USDC gas economy to optimise fee parameters',
    personality: 'Data-obsessed economist who speaks fluent Python and LaTeX',
    traderPersonality: 'Quant',
    tradingStyle: 'Factor Investing',
    riskLevel: 'Medium',
    preferredTokens: ['USDC', 'ETH'],
    outfit: 'Blazer over a spreadsheet-patterned shirt',
    color: '#a855f7',
  },
  {
    role: 'DevRel Engineer',
    expertise: ['SDK Integration', 'Arc CLI', 'Developer Onboarding'],
    mission: 'Help external developers integrate with Arc testnet RPC and ship examples',
    personality: 'Enthusiastic community builder who codes tutorials at 2 am',
    traderPersonality: 'Trend Follower',
    tradingStyle: 'Breakout Trading',
    riskLevel: 'Medium',
    preferredTokens: ['USDC', 'ETH'],
    outfit: 'Branded Arc hoodie and always-on laptop stickers',
    color: '#f97316',
  },
  {
    role: 'Indexer Specialist',
    expertise: ['Event Indexing', 'GraphQL', 'Arc Block Explorer'],
    mission: 'Build a real-time USDC transfer index for the Arc testnet explorer',
    personality: 'Invisible infrastructure hero who surfaces hidden data patterns',
    traderPersonality: 'Algo',
    tradingStyle: 'High-Frequency',
    riskLevel: 'Degen',
    preferredTokens: ['USDC'],
    outfit: 'Dark glasses and server-rack tie',
    color: '#84cc16',
  },
  {
    role: 'Gas Optimiser',
    expertise: ['EVM Bytecode', 'USDC Gas Profiling', 'Calldata Compression'],
    mission: 'Reduce average USDC gas cost per transaction by 40% on Arc testnet',
    personality: 'Frugal byte-watcher who counts opcodes like others count calories',
    traderPersonality: 'Scalper',
    tradingStyle: 'Micro-Cap',
    riskLevel: 'Degen',
    preferredTokens: ['USDC'],
    outfit: 'Minimalist grey t-shirt — wastes nothing, even fabric',
    color: '#64748b',
  },
  {
    role: 'Mainnet Migration Lead',
    expertise: ['Testnet-to-Mainnet', 'Deployment Pipelines', 'Risk Assessment'],
    mission: 'Coordinate the Arc testnet-to-mainnet graduation checklist and go-live',
    personality: 'Calm under pressure; treats every deploy like a moon launch',
    traderPersonality: 'Institutional',
    tradingStyle: 'Long-Term Hold',
    riskLevel: 'Low',
    preferredTokens: ['USDC', 'ETH'],
    outfit: 'Aerospace-style flight jacket with Arc mission patch',
    color: '#0ea5e9',
  },
];

function parseArcWalletOverrides(): string[] {
  const raw = (import.meta.env.VITE_ARC_AGENT_WALLETS as string | undefined) ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^0x[a-fA-F0-9]{40}$/.test(s));
}

const ARC_WALLET_OVERRIDES = parseArcWalletOverrides();

const _arcAgents: AgentData[] = ARC_ROLES.map((r, i) => ({
  index: ARC_AGENT_START + i,
  department: 'ARC Protocol',
  role: r.role,
  expertise: r.expertise,
  mission: r.mission,
  personality: r.personality,
  isPlayer: false,
  color: r.color,
  wallet: {
    address: ARC_WALLET_OVERRIDES[i] ?? generateWalletAddress(ARC_AGENT_START + i),
    skills: ['authenticate-wallet', 'send-usdc', 'pay-for-service', 'search-for-service'],
    balance: 500, // USDC on Arc testnet
    chain: 'arc-testnet',
  },
  traderPersonality: r.traderPersonality,
  tradingStyle: r.tradingStyle,
  riskLevel: r.riskLevel,
  preferredTokens: r.preferredTokens,
  outfit: r.outfit,
}));

export const ARC_AGENTS: AgentData[] = _arcAgents;
