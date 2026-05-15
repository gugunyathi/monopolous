/**
 * Arc Wallet Service
 *
 * Manages 10 ARC Protocol agents running on the Arc testnet blockchain.
 *
 * Network:   Arc Testnet
 * Chain ID:  5042002
 * Currency:  USDC (also used as gas)
 * RPC:       https://rpc.testnet.arc-node.thecanteenapp.com/v1/<key>
 * Explorer:  https://testnet.arcscan.app
 *
 * RPC key is issued per developer via the Canteen CLI:
 *   uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git
 *   arc-canteen login
 *   arc-canteen rpc-url   → prints your personal RPC URL
 *
 * Set VITE_ARC_RPC_KEY (or ARC_RPC_KEY server-side) in your .env.
 */

import { ARC_AGENTS, ARC_CHAIN_ID, ARC_RPC_BASE, ARC_EXPLORER, ARC_AGENT_COUNT } from '../data/agents';

// ─── Config ──────────────────────────────────────────────────────────────────

// USDC contract address on Arc testnet (same as Base mainnet USDC — Circle CCTP)
const ARC_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function getRpcKey(): string {
  return (import.meta.env.VITE_ARC_RPC_KEY as string | undefined) ?? '';
}

function getRpcUrl(): string {
  const key = getRpcKey();
  if (!key) return '';
  return `${ARC_RPC_BASE}/${key}`;
}

export function isArcConfigured(): boolean {
  return Boolean(getRpcKey());
}

export { ARC_CHAIN_ID, ARC_EXPLORER, ARC_AGENT_COUNT };

// ─── Types ───────────────────────────────────────────────────────────────────

export type ArcAgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ArcAgentWallet {
  agentIndex: number;
  address: string;
  status: ArcAgentStatus;
  usdcBalance: string;   // USDC balance as decimal string e.g. "12.50"
  nativeBalance: string; // USDC (native gas) balance
  lastCheckedAt: number;
  explorerUrl: string;
}

export interface ArcNetworkStatus {
  connected: boolean;
  chainId: number;
  blockNumber: number;
  rpcUrl: string;
  error?: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

const agentWallets = new Map<number, ArcAgentWallet>();
let networkStatus: ArcNetworkStatus = {
  connected: false,
  chainId: ARC_CHAIN_ID,
  blockNumber: 0,
  rpcUrl: '',
};

// ─── JSON-RPC helper ─────────────────────────────────────────────────────────

interface JsonRpcResponse<T = unknown> {
  id: number;
  jsonrpc: string;
  result?: T;
  error?: { code: number; message: string };
}

let _rpcId = 1;

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const url = getRpcUrl();
  if (!url) throw new Error('ARC_RPC_KEY not configured. Set VITE_ARC_RPC_KEY in your .env file.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: _rpcId++, method, params }),
  });

  if (!res.ok) throw new Error(`Arc RPC HTTP ${res.status}: ${res.statusText}`);

  const data = (await res.json()) as JsonRpcResponse<T>;
  if (data.error) throw new Error(`Arc RPC error ${data.error.code}: ${data.error.message}`);
  return data.result as T;
}

// ─── USDC ERC-20 balance call ─────────────────────────────────────────────────

function encodeBalanceOf(address: string): string {
  // balanceOf(address) selector = 0x70a08231
  const padded = address.toLowerCase().replace('0x', '').padStart(64, '0');
  return `0x70a08231${padded}`;
}

async function getUsdcBalance(address: string): Promise<string> {
  const hex = await rpc<string>('eth_call', [
    { to: ARC_USDC_ADDRESS, data: encodeBalanceOf(address) },
    'latest',
  ]);
  if (!hex || hex === '0x') return '0.00';
  const raw = BigInt(hex);
  // USDC has 6 decimals
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`;
}

async function getNativeBalance(address: string): Promise<string> {
  const hex = await rpc<string>('eth_getBalance', [address, 'latest']);
  if (!hex || hex === '0x') return '0.00';
  // On Arc, native token IS USDC (6 decimals)
  const raw = BigInt(hex);
  const whole = raw / 1_000_000n;
  const frac = raw % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, '0').slice(0, 2)}`;
}

// ─── Network check ────────────────────────────────────────────────────────────

export async function checkArcNetwork(): Promise<ArcNetworkStatus> {
  const url = getRpcUrl();
  if (!url) {
    networkStatus = { connected: false, chainId: ARC_CHAIN_ID, blockNumber: 0, rpcUrl: '', error: 'VITE_ARC_RPC_KEY not set' };
    return networkStatus;
  }

  try {
    const [chainIdHex, blockHex] = await Promise.all([
      rpc<string>('eth_chainId'),
      rpc<string>('eth_blockNumber'),
    ]);
    const chainId = parseInt(chainIdHex, 16);
    const blockNumber = parseInt(blockHex, 16);

    if (chainId !== ARC_CHAIN_ID) {
      networkStatus = { connected: false, chainId, blockNumber, rpcUrl: url, error: `Unexpected chain ID ${chainId} (expected ${ARC_CHAIN_ID})` };
    } else {
      networkStatus = { connected: true, chainId, blockNumber, rpcUrl: url };
    }
  } catch (err) {
    networkStatus = {
      connected: false, chainId: ARC_CHAIN_ID, blockNumber: 0, rpcUrl: url,
      error: err instanceof Error ? err.message : 'RPC unreachable',
    };
  }
  return networkStatus;
}

export function getArcNetworkStatus(): ArcNetworkStatus {
  return networkStatus;
}

// ─── Agent wallet provisioning ───────────────────────────────────────────────

/**
 * Initialise wallet tracking for all 10 ARC agents.
 * Sets status to 'connecting', then resolves balances via the Arc RPC.
 * Safe to call multiple times — skips already-connected agents.
 */
export async function provisionArcAgents(): Promise<ArcAgentWallet[]> {
  // First verify network
  const net = await checkArcNetwork();
  if (!net.connected) {
    console.warn('[ArcWallet] Network not reachable:', net.error);
    // Return placeholder wallets in error state
    return ARC_AGENTS.map((agent) => ({
      agentIndex: agent.index,
      address: agent.wallet.address,
      status: 'error' as ArcAgentStatus,
      usdcBalance: '0.00',
      nativeBalance: '0.00',
      lastCheckedAt: Date.now(),
      explorerUrl: `${ARC_EXPLORER}/address/${agent.wallet.address}`,
    }));
  }

  const results: ArcAgentWallet[] = [];

  for (const agent of ARC_AGENTS) {
    const existing = agentWallets.get(agent.index);
    if (existing?.status === 'connected') {
      results.push(existing);
      continue;
    }

    try {
      const [usdcBalance, nativeBalance] = await Promise.all([
        getUsdcBalance(agent.wallet.address),
        getNativeBalance(agent.wallet.address),
      ]);

      const wallet: ArcAgentWallet = {
        agentIndex: agent.index,
        address: agent.wallet.address,
        status: 'connected',
        usdcBalance,
        nativeBalance,
        lastCheckedAt: Date.now(),
        explorerUrl: `${ARC_EXPLORER}/address/${agent.wallet.address}`,
      };
      agentWallets.set(agent.index, wallet);
      results.push(wallet);
    } catch (err) {
      const wallet: ArcAgentWallet = {
        agentIndex: agent.index,
        address: agent.wallet.address,
        status: 'error',
        usdcBalance: '0.00',
        nativeBalance: '0.00',
        lastCheckedAt: Date.now(),
        explorerUrl: `${ARC_EXPLORER}/address/${agent.wallet.address}`,
      };
      agentWallets.set(agent.index, wallet);
      results.push(wallet);
      console.warn(`[ArcWallet] Failed to fetch balance for agent ${agent.index}:`, err);
    }
  }

  return results;
}

export function getArcAgentWallet(agentIndex: number): ArcAgentWallet | undefined {
  return agentWallets.get(agentIndex);
}

export function getAllArcAgentWallets(): ArcAgentWallet[] {
  return Array.from(agentWallets.values());
}

/**
 * Refresh balance for a single ARC agent.
 */
export async function refreshArcAgentBalance(agentIndex: number): Promise<ArcAgentWallet | null> {
  const agent = ARC_AGENTS.find((a) => a.index === agentIndex);
  if (!agent) return null;

  try {
    const [usdcBalance, nativeBalance] = await Promise.all([
      getUsdcBalance(agent.wallet.address),
      getNativeBalance(agent.wallet.address),
    ]);
    const wallet: ArcAgentWallet = {
      agentIndex: agent.index,
      address: agent.wallet.address,
      status: 'connected',
      usdcBalance,
      nativeBalance,
      lastCheckedAt: Date.now(),
      explorerUrl: `${ARC_EXPLORER}/address/${agent.wallet.address}`,
    };
    agentWallets.set(agentIndex, wallet);
    return wallet;
  } catch {
    return null;
  }
}

/**
 * Returns a CLI snippet the user can run via the Canteen CLI to set up
 * the Arc RPC key, for display in the UI.
 */
export function getSetupInstructions(): string {
  return [
    '# Install Canteen CLI:',
    'uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git',
    '',
    '# Log in with GitHub:',
    'arc-canteen login',
    '',
    '# Get your personal RPC URL:',
    'arc-canteen rpc-url',
    '',
    '# Add to your .env:',
    'VITE_ARC_RPC_KEY=<your-key-from-rpc-url>',
  ].join('\n');
}
