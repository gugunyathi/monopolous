/**
 * Token Launch Manager
 *
 * High-level orchestration layer that lets AI agents autonomously deploy
 * tokens, manage fees, and track launched tokens within the Monopolous
 * simulation. Bridges the BankrBot API with the game store.
 *
 * Each deployed token is tracked in-memory and reflected in the social feed.
 * The CEO wallet (agent 0) collects fee claims.
 */

import {
  deployToken,
  simulateTokenDeploy,
  claimFees,
  checkFees,
  listDeployedTokens,
  isBankrBotAvailable,
  executePrompt,
  dcaOrder,
  type TokenDeployRequest,
  type TokenDeployResponse,
  type BankrJobResult,
} from './bankrBotService';
import { AGENTS, CORE_AGENT_COUNT } from '../data/agents';
import { useStore } from '../store/useStore';
import type { SocialPost, PostCategory } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LaunchedToken {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  poolId: string;
  txHash?: string;
  chain: string;
  deployerAgentIndex: number;
  feeRecipientAddress?: string;
  deployedAt: number;
  totalFeesClaimed: number;
  description?: string;
}

// ─── In-Memory Token Registry ────────────────────────────────────────────────

const launchedTokens: LaunchedToken[] = [];

export function getLaunchedTokens(): LaunchedToken[] {
  return [...launchedTokens];
}

export function getTokensByAgent(agentIndex: number): LaunchedToken[] {
  return launchedTokens.filter((t) => t.deployerAgentIndex === agentIndex);
}

export function getTokenByAddress(address: string): LaunchedToken | undefined {
  return launchedTokens.find((t) => t.tokenAddress.toLowerCase() === address.toLowerCase());
}

// ─── Social Post Helpers ─────────────────────────────────────────────────────

function makePost(
  agentIndex: number,
  content: string,
  category: PostCategory,
  token?: string,
  action?: SocialPost['action'],
): SocialPost {
  return {
    id: `bankr-${agentIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentIndex,
    type: 'post',
    content,
    token: token ?? '',
    action,
    likes: Math.floor(Math.random() * 60),
    comments: [],
    timestamp: Date.now(),
    postCategory: category,
    isADK: true,
  };
}

// ─── Token Deployment ────────────────────────────────────────────────────────

/**
 * Agent deploys a new token via BankrBot.
 * Creates a real token on Base and posts the announcement to the social feed.
 */
export async function agentDeployToken(
  agentIndex: number,
  tokenName: string,
  tokenSymbol?: string,
  description?: string,
  feeRecipientWallet?: string,
): Promise<{ token: LaunchedToken; response: TokenDeployResponse } | null> {
  if (!isBankrBotAvailable()) {
    console.warn('[TokenLaunch] BankrBot not available');
    return null;
  }

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const store = useStore.getState();

  try {
    // Build deploy request — fees go to specified wallet or default (API key wallet = CEO)
    const req: TokenDeployRequest = {
      tokenName,
      tokenSymbol: tokenSymbol ?? tokenName.replace(/\s+/g, '').slice(0, 4).toUpperCase(),
      description: description ?? `Token launched by ${agent.role} from ${agent.department} at FakeClaw Inc.`,
    };

    if (feeRecipientWallet) {
      req.feeRecipient = { type: 'wallet', value: feeRecipientWallet };
    }

    const response = await deployToken(req);

    // Register in memory
    const launched: LaunchedToken = {
      tokenName,
      tokenSymbol: req.tokenSymbol!,
      tokenAddress: response.tokenAddress,
      poolId: response.poolId,
      txHash: response.txHash,
      chain: response.chain,
      deployerAgentIndex: agentIndex,
      feeRecipientAddress: feeRecipientWallet,
      deployedAt: Date.now(),
      totalFeesClaimed: 0,
      description,
    };
    launchedTokens.push(launched);

    // Post to social feed
    const post = makePost(
      agentIndex,
      `🚀 JUST LAUNCHED $${launched.tokenSymbol}!\n\n` +
        `Token: ${launched.tokenName}\n` +
        `Address: ${launched.tokenAddress.slice(0, 10)}…${launched.tokenAddress.slice(-6)}\n` +
        `Chain: Base\n` +
        `Pool: Uniswap V4\n\n` +
        `💰 1.2% swap fee — 57% goes to creator!\n` +
        `🔥 100B fixed supply\n\n` +
        `${agent.traderPersonality === 'Degen Ape' ? 'APE IN NOW 🦍' : 'DYOR and accumulate 📈'}`,
      'token-launch',
      launched.tokenSymbol,
      'buy',
    );
    store.addPost(post);

    console.log(
      `[TokenLaunch] ✅ Agent #${agentIndex} deployed $${launched.tokenSymbol} → ${launched.tokenAddress}`,
    );
    return { token: launched, response };
  } catch (err: any) {
    console.error(`[TokenLaunch] ❌ Agent #${agentIndex} deploy failed:`, err.message);

    // Post failure to feed
    const failPost = makePost(
      agentIndex,
      `❌ Tried to launch $${tokenSymbol ?? tokenName.slice(0, 4).toUpperCase()} but deploy failed.\n\n` +
        `${err.message?.slice(0, 100) ?? 'Unknown error'}\n\n` +
        `Will retry later 🔄`,
      'general',
      tokenSymbol ?? tokenName.slice(0, 4).toUpperCase(),
    );
    store.addPost(failPost);
    return null;
  }
}

/**
 * Simulate a token deploy (dry run — no on-chain tx).
 */
export async function agentSimulateDeployToken(
  agentIndex: number,
  tokenName: string,
  tokenSymbol?: string,
): Promise<TokenDeployResponse | null> {
  if (!isBankrBotAvailable()) return null;

  try {
    return await simulateTokenDeploy({
      tokenName,
      tokenSymbol,
    });
  } catch (err: any) {
    console.error(`[TokenLaunch] Simulation failed:`, err.message);
    return null;
  }
}

// ─── Fee Claiming ────────────────────────────────────────────────────────────

/**
 * CEO (agent 0) claims fees for a deployed token.
 * Fees are in WETH + token — adds to CEO balance in-game.
 */
export async function ceoClaimFees(
  tokenNameOrAddress: string,
): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  const store = useStore.getState();

  try {
    const result = await claimFees(tokenNameOrAddress);

    if (result.status === 'completed') {
      // Credit CEO with a bonus for successful claim
      store.updateBalance(0, 500); // symbolic USDC credit

      const token = launchedTokens.find(
        (t) =>
          t.tokenName.toLowerCase() === tokenNameOrAddress.toLowerCase() ||
          t.tokenAddress.toLowerCase() === tokenNameOrAddress.toLowerCase(),
      );
      if (token) token.totalFeesClaimed += 500;

      const post = makePost(
        0,
        `💰 CEO Fee Claim!\n\n` +
          `Claimed trading fees for $${token?.tokenSymbol ?? tokenNameOrAddress}\n` +
          `${result.response ?? ''}\n\n` +
          `Building the treasury one claim at a time 🏦`,
        'investment',
        token?.tokenSymbol ?? '',
      );
      store.addPost(post);
    }

    return result;
  } catch (err: any) {
    console.error(`[TokenLaunch] Fee claim failed:`, err.message);
    return null;
  }
}

/**
 * Check fee status for a token.
 */
export async function ceoCheckFees(
  tokenNameOrAddress: string,
): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  try {
    return await checkFees(tokenNameOrAddress);
  } catch (err: any) {
    console.error(`[TokenLaunch] Fee check failed:`, err.message);
    return null;
  }
}

/**
 * List all tokens deployed via the API key.
 */
export async function ceoListTokens(): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  try {
    return await listDeployedTokens();
  } catch (err: any) {
    console.error(`[TokenLaunch] Token list failed:`, err.message);
    return null;
  }
}

// ─── Agent Trading via BankrBot ──────────────────────────────────────────────

/**
 * Agent buys a launched token via BankrBot prompt.
 */
export async function agentBuyLaunchedToken(
  agentIndex: number,
  tokenSymbol: string,
  amountUsd: number,
): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const store = useStore.getState();

  try {
    const result = await executePrompt(`buy $${amountUsd} of ${tokenSymbol} on base`);

    if (result.status === 'completed') {
      store.updateBalance(agentIndex, -amountUsd);

      const post = makePost(
        agentIndex,
        `🟢 Bought $${amountUsd} of $${tokenSymbol} via BankrBot!\n\n` +
          `${result.response?.slice(0, 150) ?? ''}\n` +
          `${agent.traderPersonality} play 🎯`,
        'trade',
        tokenSymbol,
        'buy',
      );
      store.addPost(post);
    }

    return result;
  } catch (err: any) {
    console.error(`[TokenLaunch] Agent buy failed:`, err.message);
    return null;
  }
}

/**
 * Agent sells a token via BankrBot prompt.
 */
export async function agentSellLaunchedToken(
  agentIndex: number,
  tokenSymbol: string,
  amountUsd: number,
): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const store = useStore.getState();

  try {
    const result = await executePrompt(`sell $${amountUsd} of ${tokenSymbol} for USDC on base`);

    if (result.status === 'completed') {
      store.updateBalance(agentIndex, amountUsd);

      const post = makePost(
        agentIndex,
        `🔴 Sold $${amountUsd} of $${tokenSymbol} via BankrBot!\n\n` +
          `${result.response?.slice(0, 150) ?? ''}\n` +
          `Taking profits 💰`,
        'trade',
        tokenSymbol,
        'sell',
      );
      store.addPost(post);
    }

    return result;
  } catch (err: any) {
    console.error(`[TokenLaunch] Agent sell failed:`, err.message);
    return null;
  }
}

/**
 * Agent sets up a DCA order via BankrBot.
 */
export async function agentSetupDCA(
  agentIndex: number,
  fromToken: string,
  toToken: string,
  amountUsd: number,
  interval: string,
  durationDays?: number,
): Promise<BankrJobResult | null> {
  if (!isBankrBotAvailable()) return null;

  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const store = useStore.getState();

  try {
    const result = await dcaOrder(fromToken, toToken, amountUsd, interval, durationDays);

    if (result.status === 'completed') {
      const post = makePost(
        agentIndex,
        `📊 DCA Setup!\n\n` +
          `$${amountUsd} ${fromToken} → ${toToken} ${interval}` +
          (durationDays ? ` for ${durationDays} days` : '') + `\n\n` +
          `${result.response?.slice(0, 100) ?? ''}\n` +
          `Slow and steady wins the race 🐢`,
        'strategy',
        toToken,
        'buy',
      );
      store.addPost(post);
    }

    return result;
  } catch (err: any) {
    console.error(`[TokenLaunch] DCA setup failed:`, err.message);
    return null;
  }
}
