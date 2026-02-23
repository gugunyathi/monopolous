/**
 * Agentic Wallet Service
 * 
 * Wraps the Coinbase agentic-wallet CLI (`npx awal@2.0.3`) for
 * the player wallet, and provides read-only wallet state for NPC agents.
 * 
 * Skills installed via `npx skills add coinbase/agentic-wallet-skills`:
 *   authenticate-wallet, fund, send-usdc, trade,
 *   pay-for-service, search-for-service, monetize-service, x402
 */

import { AGENTS, getAgent, type AgentWallet, type WalletSkill } from '../data/agents';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const AWAL_BIN = 'npx awal@2.0.3';

// Base Mainnet token addresses (for reference / trade commands)
export const BASE_TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ETH:  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: '0x4200000000000000000000000000000000000006',
} as const;

// ─────────────────────────────────────────────────────────────
//  Player wallet (real agentic wallet via CLI)
// ─────────────────────────────────────────────────────────────

export interface WalletAuthStatus {
  running: boolean;
  authenticated: boolean;
  email?: string;
  address?: string;
}

export interface WalletBalance {
  balance: string; // USDC amount
  chain: string;
}

export interface SendResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  fromToken: string;
  toToken: string;
  amount: string;
  error?: string;
}

/**
 * Build a CLI command string. 
 * This is used in the UI to show the user what command an agent
 * *would* run — actual execution happens server-side or via the user's terminal.
 */
export function buildCommand(
  action: WalletSkill,
  args: Record<string, string> = {},
): string {
  switch (action) {
    case 'authenticate-wallet':
      if (args.flowId && args.otp) return `${AWAL_BIN} auth verify ${args.flowId} ${args.otp}`;
      if (args.email) return `${AWAL_BIN} auth login ${args.email}`;
      return `${AWAL_BIN} status`;

    case 'fund':
      return `${AWAL_BIN} show`; // opens companion UI for funding

    case 'send-usdc':
      return `${AWAL_BIN} send ${args.amount ?? '0'} ${args.recipient ?? '0x...'} --chain ${args.chain ?? 'base'} --json`;

    case 'trade':
      return `${AWAL_BIN} trade ${args.amount ?? '0'} ${args.from ?? 'usdc'} ${args.to ?? 'eth'} --json`;

    case 'pay-for-service': {
      const parts = [`${AWAL_BIN} x402 pay ${args.url ?? '<url>'}`];
      if (args.method && args.method !== 'GET') parts.push(`-X ${args.method}`);
      if (args.data) parts.push(`-d '${args.data}'`);
      if (args.maxAmount) parts.push(`--max-amount ${args.maxAmount}`);
      parts.push('--json');
      return parts.join(' ');
    }

    case 'search-for-service': {
      const k = args.k ? ` -k ${args.k}` : '';
      return `${AWAL_BIN} x402 bazaar search ${args.query ?? '<query>'}${k} --json`;
    }

    case 'monetize-service':
      return `${AWAL_BIN} address --json`;

    case 'x402': {
      if (args.subcommand === 'details') return `${AWAL_BIN} x402 details ${args.url ?? '<url>'} --json`;
      if (args.subcommand === 'list') return `${AWAL_BIN} x402 bazaar list --full --json`;
      const payParts = [`${AWAL_BIN} x402 pay ${args.url ?? '<url>'}`];
      if (args.method && args.method !== 'GET') payParts.push(`-X ${args.method}`);
      if (args.data) payParts.push(`-d '${args.data}'`);
      if (args.maxAmount) payParts.push(`--max-amount ${args.maxAmount}`);
      payParts.push('--json');
      return payParts.join(' ');
    }

    default:
      return `${AWAL_BIN} status`;
  }
}

// ─────────────────────────────────────────────────────────────
//  NPC wallet simulation
// ─────────────────────────────────────────────────────────────

/**
 * Look up any agent's wallet by index.
 * Returns a copy so callers can't mutate the source.
 */
export function getAgentWallet(index: number): AgentWallet | null {
  const agent = getAgent(index);
  if (!agent) return null;
  return { ...agent.wallet };
}

/**
 * Get all agent wallets (useful for leaderboard / analytics).
 */
export function getAllWallets(): { index: number; wallet: AgentWallet }[] {
  return AGENTS.map(a => ({ index: a.index, wallet: { ...a.wallet } }));
}

/**
 * Check if an agent has a specific wallet skill.
 */
export function agentHasSkill(index: number, skill: WalletSkill): boolean {
  const agent = getAgent(index);
  return agent?.wallet.skills.includes(skill) ?? false;
}

/**
 * Get the subset of skills available to an agent.
 */
export function getAgentSkills(index: number): WalletSkill[] {
  const agent = getAgent(index);
  return agent?.wallet.skills ?? [];
}

/**
 * Simulate an NPC performing a wallet action (e.g. trading, sending).
 * Returns the CLI command string the agent "would" execute.
 * In the real game loop the BehaviorManager can call this to
 * populate the social feed with agent trading activity.
 */
export function simulateAgentAction(
  index: number,
  skill: WalletSkill,
  args: Record<string, string> = {},
): { command: string; canExecute: boolean } {
  const agent = getAgent(index);
  if (!agent) return { command: '', canExecute: false };

  const canExecute = agent.wallet.skills.includes(skill);
  const command = canExecute ? buildCommand(skill, args) : '';

  return { command, canExecute };
}

/**
 * Format a wallet address for display (0x1234…abcd).
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
