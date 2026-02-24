/**
 * BankrBot Agent API Service
 *
 * Integrates with the Bankr Agent API (https://api.bankr.bot) to give
 * AI agents real on-chain capabilities:
 *
 *  - Token swaps (buy/sell via natural language prompts)
 *  - Token deployment (launch new tokens on Base)
 *  - DCA orders (dollar-cost averaging)
 *  - Limit / stop orders
 *  - Portfolio & balance checks
 *  - Fee claiming for deployed tokens
 *  - Price lookups & market data
 *
 * Architecture:
 *  1. POST /agent/prompt  → submit a natural-language command
 *  2. GET  /agent/job/:id → poll until status is completed/failed
 *  3. POST /token-launches/deploy → direct token deployment (no polling)
 *
 * All calls require the X-API-Key header.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const BANKR_API_BASE = 'https://api.bankr.bot';
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 30;          // ~60 seconds max wait
const REQUEST_TIMEOUT_MS = 15_000;

function getApiKey(): string {
  const key = process.env.BANKRBOT_API_KEY ?? '';
  if (!key) console.warn('[BankrBot] No BANKRBOT_API_KEY configured');
  return key;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type BankrJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BankrPromptResponse {
  success: boolean;
  jobId: string;
  threadId?: string;
  status: BankrJobStatus;
  message?: string;
}

export interface BankrJobResult {
  success: boolean;
  jobId: string;
  status: BankrJobStatus;
  prompt?: string;
  response?: string;
  createdAt?: string;
  completedAt?: string;
  processingTime?: number;
  error?: string;
}

export interface TokenDeployRequest {
  tokenName: string;
  tokenSymbol?: string;
  description?: string;
  image?: string;
  tweetUrl?: string;
  websiteUrl?: string;
  feeRecipient?: {
    type: 'wallet' | 'x' | 'farcaster' | 'ens';
    value: string;
  };
  simulateOnly?: boolean;
}

export interface FeeDistributionEntry {
  address: string;
  bps: number;
}

export interface TokenDeployResponse {
  success: boolean;
  tokenAddress: string;
  poolId: string;
  txHash?: string;
  activityId: string;
  chain: string;
  simulated?: boolean;
  feeDistribution?: {
    creator: FeeDistributionEntry;
    bankr: FeeDistributionEntry;
    alt: FeeDistributionEntry;
    protocol: FeeDistributionEntry;
  };
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

async function bankrFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('BANKRBOT_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BANKR_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...(options.headers ?? {}),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        `BankrBot API error ${res.status}: ${data?.message ?? data?.error ?? JSON.stringify(data)}`,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Core API Methods ────────────────────────────────────────────────────────

/**
 * Submit a natural-language prompt to the Bankr agent.
 * Returns immediately with a jobId for polling.
 */
export async function submitPrompt(prompt: string): Promise<BankrPromptResponse> {
  console.log(`[BankrBot] Submitting prompt: "${prompt.slice(0, 80)}…"`);
  return bankrFetch<BankrPromptResponse>('/agent/prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

/**
 * Poll a job until it reaches a terminal state (completed / failed / cancelled).
 */
export async function pollJob(jobId: string): Promise<BankrJobResult> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const result = await bankrFetch<BankrJobResult>(`/agent/job/${jobId}`);

    if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
      console.log(`[BankrBot] Job ${jobId} → ${result.status}`);
      return result;
    }

    // Still pending/processing — wait then retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Job ${jobId} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Submit a prompt and wait for the final result (convenience wrapper).
 */
export async function executePrompt(prompt: string): Promise<BankrJobResult> {
  const { jobId } = await submitPrompt(prompt);
  return pollJob(jobId);
}

// ─── Token Deployment (Direct REST) ──────────────────────────────────────────

/**
 * Deploy a token directly via the Token Deploy API.
 * Returns token address, pool ID, and fee distribution immediately.
 */
export async function deployToken(req: TokenDeployRequest): Promise<TokenDeployResponse> {
  console.log(`[BankrBot] Deploying token: ${req.tokenName} (${req.tokenSymbol ?? 'auto'})`);
  return bankrFetch<TokenDeployResponse>('/token-launches/deploy', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

/**
 * Simulate a token deployment without broadcasting.
 */
export async function simulateTokenDeploy(req: Omit<TokenDeployRequest, 'simulateOnly'>): Promise<TokenDeployResponse> {
  return deployToken({ ...req, simulateOnly: true });
}

// ─── High-Level Trading Commands ─────────────────────────────────────────────

/**
 * Execute a token swap via natural-language prompt.
 * e.g. "swap $50 of USDC to ETH on base"
 */
export async function swapTokens(
  fromToken: string,
  toToken: string,
  amountUsd: number,
  chain = 'base',
): Promise<BankrJobResult> {
  return executePrompt(`swap $${amountUsd} of ${fromToken} to ${toToken} on ${chain}`);
}

/**
 * Buy a token with USD amount.
 */
export async function buyToken(token: string, amountUsd: number): Promise<BankrJobResult> {
  return executePrompt(`buy $${amountUsd} of ${token} on base`);
}

/**
 * Sell a token for USDC.
 */
export async function sellToken(token: string, amountUsd: number): Promise<BankrJobResult> {
  return executePrompt(`sell $${amountUsd} of ${token} for USDC on base`);
}

/**
 * Sell a percentage of a token position.
 */
export async function sellTokenPercent(token: string, percent: number): Promise<BankrJobResult> {
  return executePrompt(`sell ${percent}% of my ${token} on base`);
}

// ─── DCA Orders ──────────────────────────────────────────────────────────────

/**
 * Set up a DCA order.
 * e.g. dcaOrder('USDC', 'ETH', 100, 'every day', 7)
 */
export async function dcaOrder(
  fromToken: string,
  toToken: string,
  amountUsd: number,
  interval: string,     // 'every day' | 'every 6 hours' | 'every hour'
  durationDays?: number,
): Promise<BankrJobResult> {
  let prompt = `DCA $${amountUsd} ${fromToken} into ${toToken} ${interval}`;
  if (durationDays) prompt += ` for ${durationDays} days`;
  return executePrompt(prompt);
}

/**
 * Cancel a DCA or automation.
 */
export async function cancelAutomation(token?: string): Promise<BankrJobResult> {
  if (token) return executePrompt(`cancel my DCA for ${token}`);
  return executePrompt('cancel all my automations');
}

// ─── Limit & Stop Orders ────────────────────────────────────────────────────

/**
 * Place a limit buy order.
 * e.g. limitBuy('ETH', 50, 15) → "buy $50 of ETH when price drops 15%"
 */
export async function limitBuy(
  token: string,
  amountUsd: number,
  dropPercent: number,
): Promise<BankrJobResult> {
  return executePrompt(`buy $${amountUsd} of ${token} when price drops ${dropPercent}%`);
}

/**
 * Place a limit sell order.
 */
export async function limitSell(
  token: string,
  risePercent: number,
): Promise<BankrJobResult> {
  return executePrompt(`sell my ${token} when it rises ${risePercent}%`);
}

/**
 * Place a stop-loss order.
 */
export async function stopLoss(
  token: string,
  dropPercent: number,
): Promise<BankrJobResult> {
  return executePrompt(`sell all my ${token} if it drops ${dropPercent}%`);
}

// ─── Portfolio & Market Data ─────────────────────────────────────────────────

export async function getBalances(): Promise<BankrJobResult> {
  return executePrompt('show my portfolio and balances on base');
}

export async function getTokenPrice(token: string): Promise<BankrJobResult> {
  return executePrompt(`price of ${token}`);
}

export async function getTrendingTokens(): Promise<BankrJobResult> {
  return executePrompt('what tokens are trending on base?');
}

export async function analyzeToken(token: string): Promise<BankrJobResult> {
  return executePrompt(`analyze ${token} price action`);
}

// ─── Fee Management ──────────────────────────────────────────────────────────

/**
 * Check accumulated fees for a deployed token.
 */
export async function checkFees(tokenNameOrAddress: string): Promise<BankrJobResult> {
  return executePrompt(`check my fees for ${tokenNameOrAddress}`);
}

/**
 * Claim fees for a deployed token.
 */
export async function claimFees(tokenNameOrAddress: string): Promise<BankrJobResult> {
  return executePrompt(`claim my fees for ${tokenNameOrAddress}`);
}

/**
 * List all tokens where the user is a fee beneficiary.
 */
export async function listDeployedTokens(): Promise<BankrJobResult> {
  return executePrompt('show all my deployed tokens with fees');
}

// ─── Transfers ───────────────────────────────────────────────────────────────

/**
 * Send tokens to an address or ENS name.
 */
export async function sendTokens(
  token: string,
  amount: number,
  recipient: string,
): Promise<BankrJobResult> {
  return executePrompt(`send ${amount} ${token} to ${recipient} on base`);
}

// ─── Staking ─────────────────────────────────────────────────────────────────

export async function stakeTokens(token: string, amount: number): Promise<BankrJobResult> {
  return executePrompt(`stake ${amount} ${token}`);
}

export async function unstakeTokens(token: string): Promise<BankrJobResult> {
  return executePrompt(`unstake my ${token}`);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Check if the BankrBot API is available (key configured).
 */
export function isBankrBotAvailable(): boolean {
  return !!getApiKey();
}

/**
 * Send a free-form prompt to Bankr (for any command not covered above).
 */
export async function freeformPrompt(prompt: string): Promise<BankrJobResult> {
  return executePrompt(prompt);
}
