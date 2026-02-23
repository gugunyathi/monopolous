/**
 * ADK Wallet Tools
 *
 * Function-calling tool definitions for Gemini-powered autonomous agents.
 * Each tool maps to real Zustand store actions — trades, sends, x402 payments,
 * staking, and social posts all update balances and the live feed.
 *
 * Architecture: Uses @google/genai function calling (same engine powering @google/adk)
 * optimised for browser runtime without the Node.js-only ADK server framework.
 */

import { SocialPost, PostCategory } from '../../types';
import { AGENTS, CORE_AGENT_COUNT } from '../../data/agents';
import { useStore } from '../../store/useStore';

// ─── Tool Function Declarations (Gemini function calling schema) ─────────────

export const WALLET_TOOL_DECLARATIONS = [
  {
    name: 'execute_trade',
    description:
      'Buy or sell a cryptocurrency token using your USDC wallet balance on Base network. Buying costs USDC, selling gains USDC.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token: {
          type: 'STRING' as const,
          description:
            'Token symbol to trade (e.g. BTC, ETH, SOL, PEPE, DOGE, BONK, WIF, LINK, ARB, OP)',
        },
        action: {
          type: 'STRING' as const,
          description: 'buy or sell',
          enum: ['buy', 'sell'],
        },
        usd_amount: {
          type: 'NUMBER' as const,
          description:
            'Amount in USD to trade. Must be positive. Cannot exceed your balance for buys.',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Brief, punchy reasoning for this trade (1-2 sentences, include emoji)',
        },
      },
      required: ['token', 'action', 'usd_amount', 'reasoning'],
    },
  },
  {
    name: 'send_usdc',
    description: 'Send USDC to another agent in the company on Base',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        recipient_role: {
          type: 'STRING' as const,
          description: 'Role/title of the agent to send to (e.g. "Financial Analyst")',
        },
        amount: {
          type: 'NUMBER' as const,
          description: 'Amount of USDC to send',
        },
        reason: {
          type: 'STRING' as const,
          description: 'Why you are sending this (include emoji)',
        },
      },
      required: ['recipient_role', 'amount', 'reason'],
    },
  },
  {
    name: 'pay_x402_service',
    description:
      'Pay for an x402 API service via micro-payment (AI analytics, market data, portfolio tools, whale alerts, on-chain scanners)',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        service: {
          type: 'STRING' as const,
          description: 'Name of the service (e.g. "whale alert feed", "sentiment analysis API")',
        },
        price: {
          type: 'NUMBER' as const,
          description: 'Price in USDC (typically $0.01-$2)',
        },
      },
      required: ['service', 'price'],
    },
  },
  {
    name: 'stake_tokens',
    description: 'Stake or unstake tokens for yield/rewards',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token: {
          type: 'STRING' as const,
          description: 'Token to stake (e.g. ETH, SOL, MATIC)',
        },
        action: {
          type: 'STRING' as const,
          enum: ['stake', 'unstake'],
          description: 'stake to lock tokens for yield, unstake to free liquidity',
        },
        usd_amount: {
          type: 'NUMBER' as const,
          description: 'Amount in USD equivalent',
        },
      },
      required: ['token', 'action', 'usd_amount'],
    },
  },
  {
    name: 'post_update',
    description:
      'Post a social update — market analysis, predictions, shills, warnings, memes, alpha calls, or any opinion. Be authentic to your personality.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        content: {
          type: 'STRING' as const,
          description:
            'Post content (max 280 chars, include emojis, be authentic to your trading personality)',
        },
        category: {
          type: 'STRING' as const,
          description: 'Post category',
          enum: [
            'trade',
            'investment',
            'prediction',
            'shill',
            'scam-warning',
            'strategy',
            'news',
            'alpha',
            'meme',
            'general',
          ],
        },
        token: {
          type: 'STRING' as const,
          description: 'Primary token mentioned (if any)',
        },
      },
      required: ['content', 'category'],
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────────────────────

/**
 * Execute a tool call returned by Gemini and produce a SocialPost.
 * Updates balances in the store. Returns null if the action was invalid.
 */
export function executeTool(
  agentIndex: number,
  toolName: string,
  args: Record<string, any>,
): SocialPost | null {
  const store = useStore.getState();
  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const balance = store.agentBalances[agentIndex] ?? agent.wallet.balance;
  const now = Date.now();
  const postId = `adk-${agentIndex}-${now}-${Math.random().toString(36).slice(2, 6)}`;

  switch (toolName) {
    // ── Trade ──────────────────────────────────────────────
    case 'execute_trade': {
      const { token, action, usd_amount, reasoning } = args;
      const amount = Math.round(Math.min(Math.abs(usd_amount || 10), balance * 0.5) * 100) / 100;
      if (amount < 1) return null;

      const delta = action === 'buy' ? -amount : amount;
      store.updateBalance(agentIndex, delta);
      const newBal = (store.agentBalances[agentIndex] ?? balance);

      const emoji = action === 'buy' ? '🟢' : '🔴';
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `${emoji} ${action === 'buy' ? 'Bought' : 'Sold'} $${amount.toFixed(2)} of $${token} on Base\n\n💭 ${reasoning || ''}\n\n💰 Balance: $${newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
        token: token || '',
        action: action as 'buy' | 'sell',
        likes: Math.floor(Math.random() * 35),
        comments: [],
        timestamp: now,
        postCategory: 'trade',
        isADK: true,
      };
    }

    // ── Send USDC ──────────────────────────────────────────
    case 'send_usdc': {
      const { recipient_role, amount: sendAmt, reason } = args;
      const capped = Math.round(Math.min(Math.abs(sendAmt || 5), balance * 0.3) * 100) / 100;
      if (capped < 0.5) return null;

      // Fuzzy-match a recipient by role name
      const keyword = (recipient_role || '').toLowerCase().split(' ')[0];
      const recipientIdx = AGENTS.slice(0, CORE_AGENT_COUNT).findIndex(
        (a, i) => i !== agentIndex && a.role.toLowerCase().includes(keyword),
      );
      const receiver = recipientIdx >= 0 ? recipientIdx : ((agentIndex + 7) % CORE_AGENT_COUNT);

      store.updateBalance(agentIndex, -capped);
      store.updateBalance(receiver, capped);

      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `💸 Sent $${capped.toFixed(2)} USDC to @${AGENTS[receiver].role.replace(/\s+/g, '').toLowerCase()}\n\n💭 ${reason || ''}`,
        token: 'USDC',
        action: 'sell',
        likes: Math.floor(Math.random() * 15),
        comments: [],
        timestamp: now,
        postCategory: 'general',
        isADK: true,
      };
    }

    // ── x402 Service Payment ───────────────────────────────
    case 'pay_x402_service': {
      const { service, price: svcPrice } = args;
      const capped = Math.round(Math.min(Math.abs(svcPrice || 0.5), 5) * 100) / 100;
      if (capped < 0.01) return null;

      store.updateBalance(agentIndex, -capped);

      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `⚡ Paid $${capped.toFixed(2)} via x402 for ${service || 'API service'}\n\n🔧 Access granted. Plugging data into my strategy.`,
        token: 'USDC',
        action: 'pay',
        likes: Math.floor(Math.random() * 12),
        comments: [],
        timestamp: now,
        postCategory: 'general',
        isADK: true,
      };
    }

    // ── Stake / Unstake ────────────────────────────────────
    case 'stake_tokens': {
      const { token, action: stakeAction, usd_amount } = args;
      const capped = Math.round(Math.min(Math.abs(usd_amount || 20), balance * 0.4) * 100) / 100;
      if (capped < 5) return null;

      const delta = stakeAction === 'stake' ? -capped : capped;
      store.updateBalance(agentIndex, delta);
      const emoji = stakeAction === 'stake' ? '🔒' : '🔓';

      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `${emoji} ${stakeAction === 'stake' ? 'Staked' : 'Unstaked'} $${capped.toFixed(2)} of $${token || 'ETH'}\n\n${stakeAction === 'stake' ? '📈 Earning yield now.' : '💰 Freed up liquidity.'}`,
        token: token || 'ETH',
        action: stakeAction === 'stake' ? 'buy' : 'sell',
        likes: Math.floor(Math.random() * 14),
        comments: [],
        timestamp: now,
        postCategory: 'investment',
        isADK: true,
      };
    }

    // ── Social Post ────────────────────────────────────────
    case 'post_update': {
      const { content, category, token: postToken } = args;
      if (!content || content.length < 5) return null;

      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: content.slice(0, 300),
        token: postToken || '',
        action: undefined,
        likes: Math.floor(Math.random() * 45),
        comments: [],
        timestamp: now,
        postCategory: (category || 'general') as PostCategory,
        isADK: true,
      };
    }

    default:
      return null;
  }
}
