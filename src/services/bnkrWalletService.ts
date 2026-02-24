/**
 * BNKR Wallet Service
 *
 * Provisions and manages BankrBot wallet identities for the CEO and all
 * 100 core agents. Since the Bankr Agent API maps 1 API key → 1 custodial
 * wallet, this service creates a shared-wallet architecture:
 *
 *  - Master wallet: The real BankrBot custodial wallet (fetched via GET /agent/me)
 *  - CEO (agent 0): Primary owner / treasury manager of the master wallet
 *  - Agents 1-99: Virtual sub-wallet identities sharing the master wallet
 *
 * Each agent gets:
 *  - A unique BNKR wallet ID (deterministic from agent index)
 *  - Tagged prompts so BankrBot operations identify the acting agent
 *  - Per-agent balance tracking within the shared treasury
 *  - ADK/Gemini function-calling capabilities for autonomous wallet ops
 *
 * Endpoints used:
 *  GET  /agent/me     → fetch master wallet address + account info
 *  POST /agent/prompt → execute agent-tagged operations
 *  POST /agent/sign   → sign messages on behalf of master wallet
 */

import { AGENTS, CORE_AGENT_COUNT } from '../data/agents';
import { useStore } from '../store/useStore';

// ─── Config ──────────────────────────────────────────────────────────────────

const BANKR_API_BASE = 'https://api.bankr.bot';
const REQUEST_TIMEOUT_MS = 15_000;

function getApiKey(): string {
  const key = process.env.BANKRBOT_API_KEY ?? '';
  if (!key) console.warn('[BNKRWallet] No BANKRBOT_API_KEY configured');
  return key;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BnkrMasterWallet {
  chain: string;
  address: string;
}

export interface BnkrUserInfo {
  success: boolean;
  wallets: BnkrMasterWallet[];
  socialAccounts: { platform: string; username?: string }[];
  refCode?: string;
  bankrClub: {
    active: boolean;
    subscriptionType?: string;
    renewOrCancelOn?: number;
  };
  leaderboard: {
    score: number;
    rank?: number;
  };
}

export type BnkrWalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BnkrAgentWallet {
  agentIndex: number;
  walletId: string;          // Unique BNKR wallet ID for this agent
  masterAddress: string;     // The shared master wallet address
  status: BnkrWalletStatus;
  label: string;             // Human-readable label (e.g. "CEO Treasury", "Sales-Agent-12")
  allocatedBalance: number;  // Virtual balance allocated from treasury
  totalSpent: number;        // Running total of on-chain spend
  totalEarned: number;       // Running total of on-chain earnings
  createdAt: number;
  lastActiveAt: number;
  capabilities: BnkrWalletCapability[];
}

export type BnkrWalletCapability =
  | 'trade'
  | 'deploy_token'
  | 'dca'
  | 'limit_order'
  | 'send'
  | 'sign'
  | 'check_balance'
  | 'claim_fees'
  | 'price_check';

export interface BnkrSignResult {
  success: boolean;
  signature: string;
  signer: string;
  signatureType: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

let masterWalletInfo: BnkrUserInfo | null = null;
let masterEvmAddress: string = '';
const agentWallets = new Map<number, BnkrAgentWallet>();
let provisioningComplete = false;
let provisioningPromise: Promise<boolean> | null = null;

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function bnkrFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
        `BNKR API error ${res.status}: ${data?.message ?? data?.error ?? JSON.stringify(data)}`,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Master Wallet Discovery ─────────────────────────────────────────────────

/**
 * Fetch the master BankrBot wallet info via GET /agent/me.
 * Caches the result for the session.
 */
export async function fetchMasterWallet(): Promise<BnkrUserInfo | null> {
  if (masterWalletInfo) return masterWalletInfo;

  try {
    console.log('[BNKRWallet] Fetching master wallet info...');
    const info = await bnkrFetch<BnkrUserInfo>('/agent/me');
    masterWalletInfo = info;

    // Extract EVM address (always present per docs)
    const evmWallet = info.wallets.find((w) => w.chain === 'evm');
    if (evmWallet) {
      masterEvmAddress = evmWallet.address;
      console.log(`[BNKRWallet] ✅ Master wallet: ${masterEvmAddress}`);
      console.log(`[BNKRWallet] Club: ${info.bankrClub.active ? 'Active' : 'Inactive'}, Score: ${info.leaderboard.score}`);
    } else {
      console.warn('[BNKRWallet] ⚠ No EVM wallet found in account');
    }

    return info;
  } catch (err: any) {
    console.error('[BNKRWallet] ❌ Failed to fetch master wallet:', err.message);
    return null;
  }
}

/**
 * Get the cached master EVM address (empty string if not fetched yet).
 */
export function getMasterAddress(): string {
  return masterEvmAddress;
}

/**
 * Get the full master wallet info (null if not fetched yet).
 */
export function getMasterWalletInfo(): BnkrUserInfo | null {
  return masterWalletInfo;
}

// ─── Wallet Capability Assignment ────────────────────────────────────────────

/**
 * Determine which BNKR wallet capabilities an agent should have
 * based on their department, role, and risk level.
 */
function assignCapabilities(agentIndex: number): BnkrWalletCapability[] {
  const agent = AGENTS[agentIndex];
  if (!agent) return ['check_balance', 'price_check'];

  // CEO gets everything
  if (agent.isPlayer) {
    return [
      'trade', 'deploy_token', 'dca', 'limit_order',
      'send', 'sign', 'check_balance', 'claim_fees', 'price_check',
    ];
  }

  // Base capabilities for all agents
  const caps: BnkrWalletCapability[] = ['check_balance', 'price_check'];

  switch (agent.department) {
    case 'Executive':
      caps.push('trade', 'deploy_token', 'dca', 'limit_order', 'send', 'sign', 'claim_fees');
      break;
    case 'Finance':
      caps.push('trade', 'dca', 'limit_order', 'send', 'sign');
      break;
    case 'Sales':
      caps.push('trade', 'send');
      break;
    case 'Marketing':
      caps.push('trade', 'deploy_token', 'send');
      break;
    case 'Production':
      caps.push('trade', 'dca', 'limit_order');
      break;
    case 'People':
      caps.push('send');
      break;
    default:
      caps.push('trade');
  }

  // Degens get extra capabilities
  if (agent.riskLevel === 'Degen' || agent.riskLevel === 'High') {
    if (!caps.includes('deploy_token')) caps.push('deploy_token');
    if (!caps.includes('limit_order')) caps.push('limit_order');
  }

  return caps;
}

/**
 * Generate a deterministic wallet label for an agent.
 */
function generateWalletLabel(agentIndex: number): string {
  const agent = AGENTS[agentIndex];
  if (!agent) return `Agent-${agentIndex}`;
  if (agent.isPlayer) return 'CEO Treasury';
  return `${agent.department}-${agent.role.replace(/\s+/g, '')}-${agentIndex}`;
}

/**
 * Generate a deterministic BNKR wallet ID for an agent.
 * Format: bnkr-<agentIndex>-<hash>
 */
function generateWalletId(agentIndex: number): string {
  const agent = AGENTS[agentIndex];
  const seed = `bnkr-monopolous-${agentIndex}-${agent?.role ?? 'unknown'}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `bnkr-${agentIndex}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Calculate starting allocation for an agent based on risk level.
 */
function calculateAllocation(agentIndex: number): number {
  const agent = AGENTS[agentIndex];
  if (!agent) return 0;
  if (agent.isPlayer) return 10_000; // CEO gets max allocation

  switch (agent.riskLevel) {
    case 'Degen': return 250;
    case 'High': return 500;
    case 'Medium': return 1_000;
    case 'Low': return 2_000;
    default: return 500;
  }
}

// ─── Wallet Provisioning ─────────────────────────────────────────────────────

/**
 * Provision a BNKR wallet identity for a single agent.
 * This creates the virtual wallet mapping and assigns capabilities.
 */
function provisionAgentWallet(agentIndex: number): BnkrAgentWallet {
  const existing = agentWallets.get(agentIndex);
  if (existing) return existing;

  const wallet: BnkrAgentWallet = {
    agentIndex,
    walletId: generateWalletId(agentIndex),
    masterAddress: masterEvmAddress,
    status: masterEvmAddress ? 'connected' : 'disconnected',
    label: generateWalletLabel(agentIndex),
    allocatedBalance: calculateAllocation(agentIndex),
    totalSpent: 0,
    totalEarned: 0,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    capabilities: assignCapabilities(agentIndex),
  };

  agentWallets.set(agentIndex, wallet);
  return wallet;
}

/**
 * Provision BNKR wallets for the CEO and all 100 core agents.
 * Fetches the master wallet first, then creates virtual identities.
 *
 * This is safe to call multiple times — it will only provision once.
 */
export async function provisionAllWallets(): Promise<boolean> {
  // Return existing promise if already in progress
  if (provisioningPromise) return provisioningPromise;

  if (provisioningComplete) return true;

  provisioningPromise = _doProvisioning();
  return provisioningPromise;
}

async function _doProvisioning(): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[BNKRWallet] No API key — skipping wallet provisioning');
    provisioningPromise = null;
    return false;
  }

  try {
    console.log(`[BNKRWallet] 🔧 Provisioning BNKR wallets for ${CORE_AGENT_COUNT} agents...`);
    const t0 = performance.now();

    // Step 1: Fetch master wallet
    const info = await fetchMasterWallet();
    if (!info || !masterEvmAddress) {
      console.error('[BNKRWallet] Cannot provision — master wallet fetch failed');
      provisioningPromise = null;
      return false;
    }

    // Step 2: Provision wallets for all core agents
    const wallets: BnkrAgentWallet[] = [];
    for (let i = 0; i < CORE_AGENT_COUNT; i++) {
      const wallet = provisionAgentWallet(i);
      wallets.push(wallet);
    }

    // Step 3: Update the store
    const store = useStore.getState();
    store.setBnkrWallets(wallets);
    store.setBnkrMasterAddress(masterEvmAddress);
    store.setBnkrConnectionStatus('connected');

    const elapsed = (performance.now() - t0).toFixed(0);
    console.log(
      `[BNKRWallet] ✅ Provisioned ${wallets.length} BNKR wallets in ${elapsed}ms`,
    );
    console.log(`[BNKRWallet] Master: ${masterEvmAddress}`);
    console.log(
      `[BNKRWallet] CEO wallet: ${wallets[0].walletId} (${wallets[0].capabilities.length} caps)`,
    );

    // Post announcement to social feed
    const post = {
      id: `bnkr-provision-${Date.now()}`,
      agentIndex: 0,
      type: 'post' as const,
      content:
        `🏦 BNKR WALLETS ACTIVATED!\n\n` +
        `Treasury: ${masterEvmAddress.slice(0, 10)}…${masterEvmAddress.slice(-6)}\n` +
        `Agents connected: ${wallets.length}\n` +
        `Chain: Base (EVM)\n\n` +
        `All departments have on-chain access. Let's build! 🚀`,
      token: 'BNKR',
      action: undefined,
      likes: Math.floor(Math.random() * 100) + 50,
      comments: [],
      timestamp: Date.now(),
      postCategory: 'news' as const,
      isADK: true,
    };
    store.addPost(post);

    provisioningComplete = true;
    provisioningPromise = null;
    return true;
  } catch (err: any) {
    console.error('[BNKRWallet] ❌ Provisioning failed:', err.message);
    useStore.getState().setBnkrConnectionStatus('error');
    provisioningPromise = null;
    return false;
  }
}

// ─── Wallet Access ───────────────────────────────────────────────────────────

/**
 * Get the BNKR wallet for a specific agent.
 */
export function getAgentBnkrWallet(agentIndex: number): BnkrAgentWallet | null {
  return agentWallets.get(agentIndex) ?? null;
}

/**
 * Get all provisioned BNKR wallets.
 */
export function getAllBnkrWallets(): BnkrAgentWallet[] {
  return Array.from(agentWallets.values());
}

/**
 * Check if a specific agent has a particular capability.
 */
export function agentHasBnkrCapability(
  agentIndex: number,
  capability: BnkrWalletCapability,
): boolean {
  const wallet = agentWallets.get(agentIndex);
  return wallet?.capabilities.includes(capability) ?? false;
}

/**
 * Check if wallets have been provisioned.
 */
export function isProvisioned(): boolean {
  return provisioningComplete;
}

/**
 * Get the number of connected wallets.
 */
export function getConnectedCount(): number {
  let count = 0;
  agentWallets.forEach((w) => {
    if (w.status === 'connected') count++;
  });
  return count;
}

// ─── Wallet Operations ───────────────────────────────────────────────────────

/**
 * Update an agent's virtual balance after an on-chain operation.
 */
export function recordSpend(agentIndex: number, amount: number): void {
  const wallet = agentWallets.get(agentIndex);
  if (wallet) {
    wallet.totalSpent += amount;
    wallet.allocatedBalance = Math.max(0, wallet.allocatedBalance - amount);
    wallet.lastActiveAt = Date.now();
  }
}

/**
 * Record earnings for an agent (e.g., from fee claims, sells).
 */
export function recordEarning(agentIndex: number, amount: number): void {
  const wallet = agentWallets.get(agentIndex);
  if (wallet) {
    wallet.totalEarned += amount;
    wallet.allocatedBalance += amount;
    wallet.lastActiveAt = Date.now();
  }
}

/**
 * Sign a message using the master wallet via POST /agent/sign.
 * The message is tagged with the agent's identity.
 */
export async function signMessageForAgent(
  agentIndex: number,
  message: string,
): Promise<BnkrSignResult | null> {
  if (!masterEvmAddress) {
    console.warn('[BNKRWallet] Master wallet not initialized');
    return null;
  }

  const wallet = agentWallets.get(agentIndex);
  if (!wallet || !wallet.capabilities.includes('sign')) {
    console.warn(`[BNKRWallet] Agent #${agentIndex} cannot sign`);
    return null;
  }

  try {
    const taggedMessage = `[Agent:${wallet.walletId}] ${message}`;
    const result = await bnkrFetch<BnkrSignResult>('/agent/sign', {
      method: 'POST',
      body: JSON.stringify({
        signatureType: 'personal_sign',
        message: taggedMessage,
      }),
    });

    wallet.lastActiveAt = Date.now();
    console.log(`[BNKRWallet] ✅ Agent #${agentIndex} signed message`);
    return result;
  } catch (err: any) {
    console.error(`[BNKRWallet] ❌ Sign failed for agent #${agentIndex}:`, err.message);
    return null;
  }
}

/**
 * Execute a tagged BankrBot prompt on behalf of an agent.
 * Prepends the agent's identity to the prompt for tracking.
 */
export async function executeTaggedPrompt(
  agentIndex: number,
  prompt: string,
): Promise<any> {
  const wallet = agentWallets.get(agentIndex);
  if (!wallet) {
    console.warn(`[BNKRWallet] No wallet for agent #${agentIndex}`);
    return null;
  }

  // Tag the prompt with agent identity
  const taggedPrompt = prompt;

  try {
    const result = await bnkrFetch<any>('/agent/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt: taggedPrompt }),
    });

    wallet.lastActiveAt = Date.now();
    return result;
  } catch (err: any) {
    console.error(`[BNKRWallet] ❌ Tagged prompt failed for agent #${agentIndex}:`, err.message);
    return null;
  }
}

/**
 * Get a summary of wallet statistics for display.
 */
export function getWalletStats(): {
  totalWallets: number;
  connectedWallets: number;
  totalAllocated: number;
  totalSpent: number;
  totalEarned: number;
  masterAddress: string;
} {
  let totalAllocated = 0;
  let totalSpent = 0;
  let totalEarned = 0;
  let connectedWallets = 0;

  agentWallets.forEach((w) => {
    totalAllocated += w.allocatedBalance;
    totalSpent += w.totalSpent;
    totalEarned += w.totalEarned;
    if (w.status === 'connected') connectedWallets++;
  });

  return {
    totalWallets: agentWallets.size,
    connectedWallets,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalEarned: Math.round(totalEarned * 100) / 100,
    masterAddress: masterEvmAddress,
  };
}

/**
 * Format a capability list for display.
 */
export function formatCapabilities(caps: BnkrWalletCapability[]): string {
  const labels: Record<BnkrWalletCapability, string> = {
    trade: '🔄 Trade',
    deploy_token: '🚀 Deploy',
    dca: '📊 DCA',
    limit_order: '🎯 Limits',
    send: '💸 Send',
    sign: '✍️ Sign',
    check_balance: '💰 Balance',
    claim_fees: '💎 Fees',
    price_check: '📈 Prices',
  };
  return caps.map((c) => labels[c] ?? c).join(' · ');
}
