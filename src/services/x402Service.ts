/**
 * x402 Payment Service
 *
 * Enables agents to discover, inspect, and pay for x402 API services.
 * Implements both buyer and seller flows per the x402 protocol:
 *
 *  Buyer flow:   search bazaar → inspect details → pay & call endpoint
 *  Seller flow:  create x402 server → register routes → receive USDC
 *
 * Payments are in USDC on Base (eip155:8453).
 * CLI: `npx awal@2.0.3 x402 …`
 */

import { getAgent, type WalletSkill } from '../data/agents';
import { buildCommand, agentHasSkill, shortAddress } from './agentWalletService';

// ─────────────────────────────────────────────────────────────
//  x402 types
// ─────────────────────────────────────────────────────────────

/** CAIP-2 network identifiers used by x402 */
export type X402Network = 'eip155:8453' | 'eip155:84532';

export const NETWORKS: Record<string, X402Network> = {
  BASE_MAINNET: 'eip155:8453',
  BASE_SEPOLIA: 'eip155:84532',
} as const;

/** A resource discovered via the x402 Bazaar. */
export interface BazaarResource {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  price: string;           // e.g. "$0.01"
  priceAtomic: number;     // USDC atomic units (6 decimals)
  network: X402Network;
  payTo: string;           // 0x… address
  mimeType?: string;
  category?: string;
  tags?: string[];
}

/** Result of an x402 payment call. */
export interface X402PaymentResult {
  success: boolean;
  statusCode: number;
  body?: unknown;
  paymentId?: string;
  amountPaid?: number;     // USDC atomic units
  error?: string;
}

/** Route config for an x402 seller endpoint. */
export interface X402RouteConfig {
  route: string;           // e.g. "GET /api/weather"
  price: string;           // e.g. "$0.01"
  network: X402Network;
  payTo: string;
  description: string;
  mimeType?: string;
  discoverable?: boolean;  // register with Bazaar
}

// ─────────────────────────────────────────────────────────────
//  USDC amount helpers
// ─────────────────────────────────────────────────────────────

const USDC_DECIMALS = 6;

/** Convert dollar string ("$0.01") to USDC atomic units. */
export function dollarToAtomic(dollar: string): number {
  const num = parseFloat(dollar.replace('$', ''));
  return Math.round(num * 10 ** USDC_DECIMALS);
}

/** Convert USDC atomic units to display string. */
export function atomicToDollar(atomic: number): string {
  return `$${(atomic / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS > 2 ? 2 : USDC_DECIMALS)}`;
}

// ─────────────────────────────────────────────────────────────
//  Buyer: CLI command builders
// ─────────────────────────────────────────────────────────────

/**
 * Build a `bazaar search` command for discovering services.
 */
export function buildSearchCommand(query: string, topK = 5): string {
  return buildCommand('search-for-service', { query, k: String(topK) });
}

/**
 * Build a `x402 details` command to inspect an endpoint's payment requirements.
 */
export function buildDetailsCommand(url: string): string {
  return `npx awal@2.0.3 x402 details ${url} --json`;
}

/**
 * Build a `x402 pay` command for making a paid API request.
 */
export function buildPayCommand(
  url: string,
  options: {
    method?: string;
    data?: string;       // JSON body
    query?: string;      // JSON query params
    maxAmount?: number;  // USDC atomic units
  } = {},
): string {
  const parts = [`npx awal@2.0.3 x402 pay ${url}`];
  if (options.method && options.method !== 'GET') {
    parts.push(`-X ${options.method}`);
  }
  if (options.data) {
    parts.push(`-d '${options.data}'`);
  }
  if (options.query) {
    parts.push(`-q '${options.query}'`);
  }
  if (options.maxAmount) {
    parts.push(`--max-amount ${options.maxAmount}`);
  }
  parts.push('--json');
  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────
//  Buyer: agent simulation
// ─────────────────────────────────────────────────────────────

/**
 * Simulate an NPC agent discovering and paying for an x402 service.
 * Returns the sequence of commands + social post content.
 */
export function simulateX402Purchase(
  agentIndex: number,
  service: BazaarResource,
): {
  canPay: boolean;
  commands: string[];
  postContent: string;
  costUSDC: number;
} {
  const agent = getAgent(agentIndex);
  if (!agent) return { canPay: false, commands: [], postContent: '', costUSDC: 0 };

  const hasPaySkill = agentHasSkill(agentIndex, 'pay-for-service') || agentHasSkill(agentIndex, 'x402');
  const cost = service.priceAtomic / 10 ** USDC_DECIMALS;
  const canAfford = agent.wallet.balance >= cost;
  const canPay = hasPaySkill && canAfford;

  const commands = [
    // Step 1: check auth
    buildCommand('authenticate-wallet'),
    // Step 2: check balance
    `npx awal@2.0.3 balance --json`,
    // Step 3: pay
    buildPayCommand(service.url, { method: service.method }),
  ];

  const addr = shortAddress(agent.wallet.address);
  const postContent = canPay
    ? `🔗 Just paid ${service.price} USDC for "${service.description}" via x402. Wallet: ${addr} 💸`
    : `⚠️ Wanted to use "${service.description}" (${service.price}) but ${!hasPaySkill ? 'missing pay skill' : 'insufficient balance'}. ${addr}`;

  return { canPay, commands, postContent, costUSDC: cost };
}

// ─────────────────────────────────────────────────────────────
//  Seller: route config builder
// ─────────────────────────────────────────────────────────────

/**
 * Generate the Express paymentMiddleware config object for an x402 seller endpoint.
 * Useful for the monetize-service skill / agent-created APIs.
 */
export function buildRouteConfig(config: X402RouteConfig): Record<string, unknown> {
  return {
    [config.route]: {
      accepts: [
        {
          scheme: 'exact',
          price: config.price,
          network: config.network,
          payTo: config.payTo,
        },
      ],
      description: config.description,
      mimeType: config.mimeType ?? 'application/json',
      ...(config.discoverable
        ? {
            extensions: {
              bazaar: {
                discoverable: true,
              },
            },
          }
        : {}),
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  Sample bazaar services (for NPC simulation)
// ─────────────────────────────────────────────────────────────

/** Curated list of x402 services NPCs can interact with in-game. */
export const SAMPLE_BAZAAR_SERVICES: BazaarResource[] = [
  {
    url: 'https://x402-weather.example.com/api/weather',
    method: 'GET',
    description: 'Real-time weather data for any location',
    price: '$0.001',
    priceAtomic: 1000,
    network: 'eip155:8453',
    payTo: '0x1234567890abcdef1234567890abcdef12345678',
    mimeType: 'application/json',
    category: 'weather',
    tags: ['forecast', 'real-time'],
  },
  {
    url: 'https://x402-sentiment.example.com/api/sentiment',
    method: 'POST',
    description: 'AI-powered text sentiment analysis',
    price: '$0.01',
    priceAtomic: 10000,
    network: 'eip155:8453',
    payTo: '0xabcdef1234567890abcdef1234567890abcdef12',
    mimeType: 'application/json',
    category: 'ai',
    tags: ['sentiment', 'nlp', 'ai'],
  },
  {
    url: 'https://x402-market.example.com/api/prices',
    method: 'GET',
    description: 'Live crypto market prices and volume data',
    price: '$0.005',
    priceAtomic: 5000,
    network: 'eip155:8453',
    payTo: '0x9876543210fedcba9876543210fedcba98765432',
    mimeType: 'application/json',
    category: 'finance',
    tags: ['crypto', 'prices', 'market-data'],
  },
  {
    url: 'https://x402-news.example.com/api/headlines',
    method: 'GET',
    description: 'Breaking crypto news and headlines feed',
    price: '$0.002',
    priceAtomic: 2000,
    network: 'eip155:8453',
    payTo: '0xfedcba9876543210fedcba9876543210fedcba98',
    mimeType: 'application/json',
    category: 'news',
    tags: ['crypto', 'news', 'headlines'],
  },
  {
    url: 'https://x402-onchain.example.com/api/analytics',
    method: 'POST',
    description: 'On-chain analytics and wallet profiling',
    price: '$0.05',
    priceAtomic: 50000,
    network: 'eip155:8453',
    payTo: '0x1111222233334444555566667777888899990000',
    mimeType: 'application/json',
    category: 'analytics',
    tags: ['onchain', 'analytics', 'wallet'],
  },
  {
    url: 'https://x402-risk.example.com/api/score',
    method: 'POST',
    description: 'DeFi protocol risk scoring and audit reports',
    price: '$0.10',
    priceAtomic: 100000,
    network: 'eip155:8453',
    payTo: '0xaaabbbcccdddeeefff0001112223334445556667',
    mimeType: 'application/json',
    category: 'security',
    tags: ['risk', 'audit', 'defi'],
  },
];

/**
 * Pick a random service appropriate for an agent's department.
 */
export function pickServiceForAgent(agentIndex: number): BazaarResource {
  const agent = getAgent(agentIndex);
  const dept = agent?.department ?? '';

  // Map departments to preferred service categories
  const deptPrefs: Record<string, string[]> = {
    Production: ['ai', 'analytics'],
    Sales: ['news', 'finance'],
    Marketing: ['sentiment', 'news'],
    Finance: ['finance', 'analytics', 'security'],
    Executive: ['finance', 'analytics', 'security'],
    People: ['news', 'weather'],
  };

  const preferred = deptPrefs[dept] ?? [];
  const matching = SAMPLE_BAZAAR_SERVICES.filter(
    s => preferred.some(p => s.category === p || s.tags?.includes(p)),
  );

  // Return a matching service or fall back to a random one
  if (matching.length > 0) {
    return matching[agentIndex % matching.length];
  }
  return SAMPLE_BAZAAR_SERVICES[agentIndex % SAMPLE_BAZAAR_SERVICES.length];
}

// ─────────────────────────────────────────────────────────────
//  Input validation (mirrors skill docs)
// ─────────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/[^\s;|&`]+$/;
const MAX_AMOUNT_RE = /^\d+$/;

export function isValidUrl(url: string): boolean {
  return URL_RE.test(url);
}

export function isValidMaxAmount(amount: string): boolean {
  return MAX_AMOUNT_RE.test(amount);
}

export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
