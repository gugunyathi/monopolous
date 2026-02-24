/**
 * ADK Wallet Tools
 *
 * Function-calling tool definitions for Gemini-powered autonomous agents.
 * Each tool maps to real Zustand store actions — trades, sends, x402 payments,
 * staking, and social posts all update balances and the live feed.
 *
 * Now includes BankrBot integration for real on-chain operations:
 * token deployment, swaps, DCA orders, limit orders, and fee claiming.
 *
 * Architecture: Uses @google/genai function calling (same engine powering @google/adk)
 * optimised for browser runtime without the Node.js-only ADK server framework.
 */

import { SocialPost, PostCategory } from '../../types';
import { AGENTS, CORE_AGENT_COUNT } from '../../data/agents';
import { useStore } from '../../store/useStore';
import {
  POLYMARKET_SIMULATED,
  searchMarkets,
  placeBet,
  formatMarketForPost,
  getYesTokenId,
  type PolyMarket,
} from '../polymarketService';
import {
  isBankrBotAvailable,
  executePrompt as bankrExecutePrompt,
} from '../bankrBotService';
import {
  agentDeployToken,
  agentBuyLaunchedToken,
  agentSellLaunchedToken,
  agentSetupDCA,
  getLaunchedTokens,
  ceoClaimFees,
} from '../tokenLaunchService';
import {
  getAgentBnkrWallet,
  agentHasBnkrCapability,
  signMessageForAgent,
  recordSpend,
  recordEarning,
  isProvisioned,
  formatCapabilities,
} from '../bnkrWalletService';

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

// ─── BankrBot Tool Declarations (real on-chain via Bankr Agent API) ──────────

export const BANKR_TOOL_DECLARATIONS = [
  {
    name: 'bankr_deploy_token',
    description:
      'Deploy a NEW token on Base! Creates a real token with Uniswap V4 liquidity pool. The token will have a 1.2% swap fee (57% goes to creator). Fixed supply of 100 billion tokens. Use creative and catchy names.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token_name: {
          type: 'STRING' as const,
          description: 'Name of the token (1-100 chars). Be creative! e.g. "FakeClawCoin", "DepartmentDoge"',
        },
        token_symbol: {
          type: 'STRING' as const,
          description: 'Ticker symbol (1-10 chars). e.g. "FCLAW", "DDOGE"',
        },
        description: {
          type: 'STRING' as const,
          description: 'Short description of the token (max 500 chars)',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Why you are launching this token (1-2 sentences, include emoji)',
        },
      },
      required: ['token_name', 'token_symbol', 'reasoning'],
    },
  },
  {
    name: 'bankr_swap',
    description:
      'Execute a REAL token swap on Base via BankrBot. Supports any token pair. e.g. swap USDC to ETH, buy BNKR with USDC, sell DEGEN for USDC.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        from_token: {
          type: 'STRING' as const,
          description: 'Token to sell/swap from (e.g. USDC, ETH, BNKR)',
        },
        to_token: {
          type: 'STRING' as const,
          description: 'Token to buy/swap to (e.g. ETH, USDC, BNKR)',
        },
        amount_usd: {
          type: 'NUMBER' as const,
          description: 'USD value to swap. Must be at least $1.',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Brief reasoning for this swap (include emoji)',
        },
      },
      required: ['from_token', 'to_token', 'amount_usd', 'reasoning'],
    },
  },
  {
    name: 'bankr_dca',
    description:
      'Set up a Dollar-Cost Averaging (DCA) order on Base. Automatically buys a token at regular intervals. Great for accumulating positions gradually. Minimum $20 per execution.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        from_token: {
          type: 'STRING' as const,
          description: 'Token to spend (usually USDC)',
        },
        to_token: {
          type: 'STRING' as const,
          description: 'Token to accumulate',
        },
        amount_usd: {
          type: 'NUMBER' as const,
          description: 'Amount per DCA execution in USD (minimum $20)',
        },
        interval: {
          type: 'STRING' as const,
          description: 'Frequency: "every hour", "every 6 hours", "every day"',
          enum: ['every hour', 'every 6 hours', 'every 12 hours', 'every day'],
        },
        duration_days: {
          type: 'NUMBER' as const,
          description: 'How many days to run the DCA (max 30)',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Why this DCA strategy (include emoji)',
        },
      },
      required: ['from_token', 'to_token', 'amount_usd', 'interval', 'reasoning'],
    },
  },
  {
    name: 'bankr_limit_order',
    description:
      'Place a limit buy or stop-loss order on Base. Buy when price drops X%, or sell when it rises X%.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token: {
          type: 'STRING' as const,
          description: 'Token symbol',
        },
        order_type: {
          type: 'STRING' as const,
          description: 'Type of order',
          enum: ['limit_buy', 'limit_sell', 'stop_loss'],
        },
        amount_usd: {
          type: 'NUMBER' as const,
          description: 'USD amount (for limit_buy)',
        },
        trigger_percent: {
          type: 'NUMBER' as const,
          description: 'Price change percentage to trigger (e.g. 10 for 10%)',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Brief reasoning (include emoji)',
        },
      },
      required: ['token', 'order_type', 'trigger_percent', 'reasoning'],
    },
  },
  {
    name: 'bankr_check_price',
    description:
      'Get the current price and analysis for a token via BankrBot.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token: {
          type: 'STRING' as const,
          description: 'Token symbol to check (e.g. ETH, BTC, SOL, BNKR)',
        },
        analyze: {
          type: 'BOOLEAN' as const,
          description: 'If true, include technical analysis. Default false.',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'bankr_claim_fees',
    description:
      'Claim accumulated trading fees from a token you deployed. Fees are in WETH + your token. CEO wallet collects all fees.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        token_name_or_address: {
          type: 'STRING' as const,
          description: 'Token name or contract address to claim fees for',
        },
      },
      required: ['token_name_or_address'],
    },
  },
];

// ─── Polymarket Tool Declarations ───────────────────────────────────────────

export const POLYMARKET_TOOL_DECLARATIONS = [
  {
    name: 'search_polymarket_markets',
    description:
      'Search Polymarket prediction markets for events to bet on. Returns active markets with current YES/NO prices and volume. No wallet needed.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: {
          type: 'STRING' as const,
          description: 'Search query — topic or event to look for (e.g. "bitcoin", "election", "fed rate", "crypto")',
        },
        limit: {
          type: 'NUMBER' as const,
          description: 'Number of markets to return (1-5, default 3)',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Why you are researching these prediction markets (include emoji)',
        },
      },
      required: ['query', 'reasoning'],
    },
  },
  {
    name: 'place_polymarket_bet',
    description:
      'Place a prediction market bet on Polymarket. Buy YES or NO shares on an active market. Costs USDC from your balance. Currently simulated — no real Polygon transactions until bridge funding is set up.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        market_id: {
          type: 'STRING' as const,
          description: 'Polymarket market ID (from search_polymarket_markets results)',
        },
        market_question: {
          type: 'STRING' as const,
          description: 'The market question text (for the social post)',
        },
        token_id: {
          type: 'STRING' as const,
          description: 'YES token ID from the market (from search results)',
        },
        side: {
          type: 'STRING' as const,
          description: 'YES to bet it happens, NO to bet it does not',
          enum: ['YES', 'NO'],
        },
        amount: {
          type: 'NUMBER' as const,
          description: 'Amount in USDC to bet (min $1, max 20% of balance)',
        },
        reasoning: {
          type: 'STRING' as const,
          description: 'Why you are taking this position — your prediction thesis (include emoji)',
        },
      },
      required: ['market_id', 'market_question', 'side', 'amount', 'reasoning'],
    },
  },
];

// ─── BNKR Wallet Tool Declarations ──────────────────────────────────────────

export const BNKR_WALLET_TOOL_DECLARATIONS = [
  {
    name: 'bnkr_check_wallet',
    description:
      'Check your BNKR wallet status, balance, and capabilities. Shows your connected wallet info and what operations you can perform.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        detail_level: {
          type: 'STRING' as const,
          description: 'How much detail to show',
          enum: ['summary', 'full'],
        },
      },
      required: [],
    },
  },
  {
    name: 'bnkr_sign_message',
    description:
      'Sign a message using your BNKR wallet. Useful for proving wallet ownership, authentication, or creating verifiable statements.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        message: {
          type: 'STRING' as const,
          description: 'The message to sign (max 500 chars)',
        },
        purpose: {
          type: 'STRING' as const,
          description: 'Why you are signing this (for the social post)',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'bnkr_check_portfolio',
    description:
      'Check the master BNKR wallet portfolio and balance breakdown across all connected agents. Shows the treasury status.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        scope: {
          type: 'STRING' as const,
          description: 'What to check',
          enum: ['my_allocation', 'treasury_overview', 'department_breakdown'],
        },
      },
      required: ['scope'],
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

    // ── Polymarket — placeholder (async execution follows) ─────────────────
    case 'search_polymarket_markets': {
      const { query, reasoning } = args;
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `🔍 Scanning Polymarket for "${query || 'predictions'}}"…\n\n💭 ${reasoning || 'Researching prediction markets'}`,
        token: '',
        action: 'search' as const,
        likes: Math.floor(Math.random() * 10),
        comments: [],
        timestamp: now,
        postCategory: 'prediction',
        isADK: true,
      };
    }

    case 'place_polymarket_bet': {
      const { market_question, side, amount: betAmt, reasoning: betReason } = args;
      const cappedBet = Math.round(Math.min(Math.abs(betAmt || 5), balance * 0.2) * 100) / 100;
      if (cappedBet < 1) return null;

      // Deduct from balance immediately (simulated)
      store.updateBalance(agentIndex, -cappedBet);
      const newBal = store.agentBalances[agentIndex] ?? balance;

      const sideEmoji = side === 'YES' ? '🟢' : '🔴';
      const simLabel = POLYMARKET_SIMULATED ? ' [SIM]' : '';
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content:
          `${sideEmoji} Polymarket Bet${simLabel}\n\n` +
          `"${(market_question || '???').slice(0, 80)}"\n` +
          `Position: ${side} | $${cappedBet.toFixed(2)} USDC\n\n` +
          `💭 ${betReason || ''}\n` +
          `💰 Balance: $${newBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
        token: 'USDC',
        action: 'buy' as const,
        likes: Math.floor(Math.random() * 30),
        comments: [],
        timestamp: now,
        postCategory: 'prediction',
        isADK: true,
        polymarket: {
          marketId:  args.market_id || '',
          question:  market_question || '',
          side:      side as 'YES' | 'NO',
          amount:    cappedBet,
          simulated: POLYMARKET_SIMULATED,
        },
      };
    }

    // ── BankrBot tools return a placeholder post; actual execution is async ──
    case 'bankr_deploy_token':
    case 'bankr_swap':
    case 'bankr_dca':
    case 'bankr_limit_order':
    case 'bankr_check_price':
    case 'bankr_claim_fees': {
      // Return an immediate "pending" post; the async executor will update
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `⏳ Processing BankrBot action: ${toolName.replace('bankr_', '').replace(/_/g, ' ')}...\n\n${args.reasoning || args.token || ''}`,
        token: args.token_symbol || args.to_token || args.token || '',
        action: undefined,
        likes: 0,
        comments: [],
        timestamp: now,
        postCategory: 'general',
        isADK: true,
      };
    }

    // ── BNKR Wallet Tools ──────────────────────────────────
    case 'bnkr_check_wallet': {
      const bnkrWallet = getAgentBnkrWallet(agentIndex);
      if (!bnkrWallet) {
        return {
          id: postId,
          agentIndex,
          type: 'post',
          content: `❌ No BNKR wallet provisioned. Waiting for wallet setup... 🔄`,
          token: '',
          action: undefined,
          likes: 0,
          comments: [],
          timestamp: now,
          postCategory: 'general',
          isADK: true,
        };
      }
      const detail = args.detail_level || 'summary';
      const capsStr = formatCapabilities(bnkrWallet.capabilities as any);
      const content = detail === 'full'
        ? `🏦 BNKR Wallet Status\n\n` +
          `ID: ${bnkrWallet.walletId}\n` +
          `Master: ${bnkrWallet.masterAddress.slice(0, 10)}…\n` +
          `Status: ${bnkrWallet.status} ✅\n` +
          `Balance: $${bnkrWallet.allocatedBalance.toFixed(2)}\n` +
          `Spent: $${bnkrWallet.totalSpent.toFixed(2)}\n` +
          `Earned: $${bnkrWallet.totalEarned.toFixed(2)}\n` +
          `Caps: ${capsStr}`
        : `🏦 BNKR: ${bnkrWallet.status === 'connected' ? '🟢' : '🔴'} $${bnkrWallet.allocatedBalance.toFixed(2)} | ${capsStr}`;
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: content.slice(0, 300),
        token: 'BNKR',
        action: undefined,
        likes: Math.floor(Math.random() * 15),
        comments: [],
        timestamp: now,
        postCategory: 'general',
        isADK: true,
      };
    }

    case 'bnkr_sign_message':
    case 'bnkr_check_portfolio': {
      return {
        id: postId,
        agentIndex,
        type: 'post',
        content: `⏳ Processing BNKR wallet action: ${toolName.replace('bnkr_', '').replace(/_/g, ' ')}...`,
        token: 'BNKR',
        action: undefined,
        likes: 0,
        comments: [],
        timestamp: now,
        postCategory: 'general',
        isADK: true,
      };
    }

    default:
      return null;
  }
}

// ─── Async BankrBot Tool Execution ───────────────────────────────────────────

/**
 * Execute a BankrBot tool asynchronously. Called after executeTool returns the
 * placeholder post. This actually hits the Bankr API and posts results.
 */
export async function executeBankrTool(
  agentIndex: number,
  toolName: string,
  args: Record<string, any>,
): Promise<SocialPost | null> {
  if (!isBankrBotAvailable()) {
    console.warn('[ADK] BankrBot not available for tool:', toolName);
    return null;
  }

  const store = useStore.getState();
  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const now = Date.now();
  const postId = `bankr-${agentIndex}-${now}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    switch (toolName) {
      // ── Deploy Token ────────────────────────────────────
      case 'bankr_deploy_token': {
        const { token_name, token_symbol, description: desc, reasoning } = args;
        const result = await agentDeployToken(
          agentIndex,
          token_name,
          token_symbol,
          desc,
        );
        if (result) {
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `🚀 TOKEN DEPLOYED via BankrBot!\n\n` +
              `$${result.token.tokenSymbol} (${result.token.tokenName})\n` +
              `📍 ${result.token.tokenAddress.slice(0, 10)}…${result.token.tokenAddress.slice(-6)}\n` +
              `⛓️ Base | Uniswap V4 Pool\n` +
              `💰 57% swap fees to creator\n\n` +
              `💭 ${reasoning || 'LFG!'}\n\n` +
              `Trade now → $${result.token.tokenSymbol} 🔥`,
            token: result.token.tokenSymbol,
            action: 'buy',
            likes: Math.floor(Math.random() * 80) + 20,
            comments: [],
            timestamp: now,
            postCategory: 'token-launch',
            isADK: true,
          };
        }
        return null;
      }

      // ── Swap ────────────────────────────────────────────
      case 'bankr_swap': {
        const { from_token, to_token, amount_usd, reasoning } = args;
        const amount = Math.max(1, Math.abs(amount_usd || 10));

        const result = await bankrExecutePrompt(
          `swap $${amount} of ${from_token} to ${to_token} on base`,
        );

        if (result.status === 'completed') {
          store.updateBalance(agentIndex, from_token === 'USDC' ? -amount : 0);

          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `🔄 SWAPPED via BankrBot!\n\n` +
              `$${amount} ${from_token} → ${to_token}\n` +
              `${result.response?.slice(0, 120) || ''}\n\n` +
              `💭 ${reasoning || ''}`,
            token: to_token,
            action: from_token === 'USDC' ? 'buy' : 'sell',
            likes: Math.floor(Math.random() * 40),
            comments: [],
            timestamp: now,
            postCategory: 'trade',
            isADK: true,
          };
        }

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content: `❌ Swap failed: ${result.response || result.error || 'Unknown error'}\n\nWill retry later 🔄`,
          token: to_token,
          action: undefined,
          likes: 0,
          comments: [],
          timestamp: now,
          postCategory: 'general',
          isADK: true,
        };
      }

      // ── DCA ─────────────────────────────────────────────
      case 'bankr_dca': {
        const { from_token, to_token, amount_usd, interval, duration_days, reasoning } = args;
        const result = await agentSetupDCA(
          agentIndex,
          from_token,
          to_token,
          Math.max(20, amount_usd || 25),
          interval,
          duration_days,
        );

        if (result && result.status === 'completed') {
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `📊 DCA ORDER SET via BankrBot!\n\n` +
              `$${amount_usd} ${from_token} → ${to_token}\n` +
              `⏰ ${interval}` + (duration_days ? ` for ${duration_days} days` : '') + `\n` +
              `${result.response?.slice(0, 100) || ''}\n\n` +
              `💭 ${reasoning || 'Slow and steady 🐢'}`,
            token: to_token,
            action: 'buy',
            likes: Math.floor(Math.random() * 30),
            comments: [],
            timestamp: now,
            postCategory: 'strategy',
            isADK: true,
          };
        }

        return null;
      }

      // ── Limit / Stop Orders ─────────────────────────────
      case 'bankr_limit_order': {
        const { token, order_type, amount_usd, trigger_percent, reasoning } = args;

        let prompt: string;
        if (order_type === 'limit_buy') {
          prompt = `buy $${amount_usd || 50} of ${token} when price drops ${trigger_percent}%`;
        } else if (order_type === 'limit_sell') {
          prompt = `sell my ${token} when it rises ${trigger_percent}%`;
        } else {
          prompt = `sell all my ${token} if it drops ${trigger_percent}%`;
        }

        const result = await bankrExecutePrompt(prompt);

        const typeLabel = order_type === 'limit_buy' ? '🎯 LIMIT BUY' :
                          order_type === 'limit_sell' ? '📈 LIMIT SELL' : '🛑 STOP LOSS';

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content:
            `${typeLabel} SET via BankrBot!\n\n` +
            `$${token} @ ${trigger_percent}% trigger\n` +
            `${result.response?.slice(0, 100) || ''}\n\n` +
            `💭 ${reasoning || 'Setting up my exit/entry strategy'}`,
          token,
          action: order_type === 'limit_buy' ? 'buy' : 'sell',
          likes: Math.floor(Math.random() * 25),
          comments: [],
          timestamp: now,
          postCategory: 'strategy',
          isADK: true,
        };
      }

      // ── Price Check ─────────────────────────────────────
      case 'bankr_check_price': {
        const { token, analyze } = args;
        const prompt = analyze ? `analyze ${token} price action` : `price of ${token}`;
        const result = await bankrExecutePrompt(prompt);

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content:
            `📊 ${token} Price Check via BankrBot\n\n` +
            `${result.response?.slice(0, 220) || 'No data available'}\n\n` +
            `#${token} #PriceAction`,
          token,
          action: undefined,
          likes: Math.floor(Math.random() * 20),
          comments: [],
          timestamp: now,
          postCategory: analyze ? 'alpha' : 'news',
          isADK: true,
        };
      }

      // ── Claim Fees ──────────────────────────────────────
      case 'bankr_claim_fees': {
        const { token_name_or_address } = args;

        // Only CEO (agent 0) or the deployer can claim
        const result = await ceoClaimFees(token_name_or_address);

        if (result && result.status === 'completed') {
          return {
            id: postId,
            agentIndex: 0, // CEO claims
            type: 'post',
            content:
              `💰 FEES CLAIMED!\n\n` +
              `Token: $${token_name_or_address}\n` +
              `${result.response?.slice(0, 150) || ''}\n\n` +
              `57% creator share → treasury 🏦`,
            token: '',
            action: undefined,
            likes: Math.floor(Math.random() * 50) + 10,
            comments: [],
            timestamp: now,
            postCategory: 'investment',
            isADK: true,
          };
        }

        return null;
      }

      default:
        return null;
    }
  } catch (err: any) {
    console.error(`[ADK/BankrBot] ❌ ${toolName} failed:`, err.message);
    return {
      id: postId,
      agentIndex,
      type: 'post',
      content: `❌ BankrBot action failed: ${toolName.replace('bankr_', '')}\n\n${err.message?.slice(0, 100) || 'Unknown error'}`,
      token: '',
      action: undefined,
      likes: 0,
      comments: [],
      timestamp: now,
      postCategory: 'general',
      isADK: true,
    };
  }
}

// ─── Async BNKR Wallet Tool Execution ────────────────────────────────────────

/**
 * Execute BNKR wallet tools that require async operations (signing, portfolio checks).
 */
export async function executeBnkrWalletTool(
  agentIndex: number,
  toolName: string,
  args: Record<string, any>,
): Promise<SocialPost | null> {
  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const bnkrWallet = getAgentBnkrWallet(agentIndex);
  if (!bnkrWallet) {
    console.warn(`[ADK/BNKR] No BNKR wallet for agent #${agentIndex}`);
    return null;
  }

  const now = Date.now();
  const postId = `bnkr-${agentIndex}-${now}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    switch (toolName) {
      case 'bnkr_sign_message': {
        if (!agentHasBnkrCapability(agentIndex, 'sign')) {
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content: `❌ No signing permission on my BNKR wallet 🔒`,
            token: 'BNKR',
            action: undefined,
            likes: 0,
            comments: [],
            timestamp: now,
            postCategory: 'general',
            isADK: true,
          };
        }

        const { message, purpose } = args;
        const result = await signMessageForAgent(agentIndex, message || 'Verify wallet');

        if (result && result.success) {
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `✍️ SIGNED via BNKR Wallet!\n\n` +
              `Signer: ${result.signer.slice(0, 10)}…${result.signer.slice(-4)}\n` +
              `Sig: ${result.signature.slice(0, 20)}…\n` +
              `${purpose ? `Purpose: ${purpose}\n` : ''}` +
              `\n🔐 Verified on-chain identity`,
            token: 'BNKR',
            action: undefined,
            likes: Math.floor(Math.random() * 25),
            comments: [],
            timestamp: now,
            postCategory: 'general',
            isADK: true,
          };
        }

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content: `❌ Message signing failed. Will retry later 🔄`,
          token: 'BNKR',
          action: undefined,
          likes: 0,
          comments: [],
          timestamp: now,
          postCategory: 'general',
          isADK: true,
        };
      }

      case 'bnkr_check_portfolio': {
        const { scope } = args;
        const store = useStore.getState();
        const allWallets = store.bnkrWallets;

        if (scope === 'treasury_overview') {
          const totalAlloc = allWallets.reduce((s, w) => s + w.allocatedBalance, 0);
          const totalSpent = allWallets.reduce((s, w) => s + w.totalSpent, 0);
          const connected = allWallets.filter((w) => w.status === 'connected').length;

          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `🏦 BNKR Treasury Overview\n\n` +
              `Master: ${bnkrWallet.masterAddress.slice(0, 10)}…\n` +
              `Wallets: ${connected}/${allWallets.length} connected\n` +
              `Total allocated: $${totalAlloc.toFixed(2)}\n` +
              `Total spent: $${totalSpent.toFixed(2)}\n\n` +
              `Treasury is ${connected === allWallets.length ? 'fully operational ✅' : 'partially active ⚠️'}`,
            token: 'BNKR',
            action: undefined,
            likes: Math.floor(Math.random() * 30),
            comments: [],
            timestamp: now,
            postCategory: 'investment',
            isADK: true,
          };
        } else if (scope === 'department_breakdown') {
          const deptMap: Record<string, { count: number; balance: number }> = {};
          allWallets.forEach((w) => {
            const a = AGENTS[w.agentIndex];
            if (!a) return;
            const dept = a.department;
            if (!deptMap[dept]) deptMap[dept] = { count: 0, balance: 0 };
            deptMap[dept].count++;
            deptMap[dept].balance += w.allocatedBalance;
          });

          const breakdown = Object.entries(deptMap)
            .sort((a, b) => b[1].balance - a[1].balance)
            .slice(0, 5)
            .map(([dept, info]) => `${dept}: ${info.count} agents, $${info.balance.toFixed(0)}`)
            .join('\n');

          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `📊 BNKR Department Breakdown\n\n${breakdown}\n\n` +
              `Diversified across ${Object.keys(deptMap).length} departments 💼`,
            token: 'BNKR',
            action: undefined,
            likes: Math.floor(Math.random() * 20),
            comments: [],
            timestamp: now,
            postCategory: 'investment',
            isADK: true,
          };
        } else {
          // my_allocation
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content:
              `💰 My BNKR Allocation\n\n` +
              `Balance: $${bnkrWallet.allocatedBalance.toFixed(2)}\n` +
              `Spent: $${bnkrWallet.totalSpent.toFixed(2)}\n` +
              `Earned: $${bnkrWallet.totalEarned.toFixed(2)}\n` +
              `${formatCapabilities(bnkrWallet.capabilities as any)}\n\n` +
              `Ready to trade 🚀`,
            token: 'BNKR',
            action: undefined,
            likes: Math.floor(Math.random() * 15),
            comments: [],
            timestamp: now,
            postCategory: 'investment',
            isADK: true,
          };
        }
      }

      default:
        return null;
    }
  } catch (err: any) {
    console.error(`[ADK/BNKR] ❌ ${toolName} failed:`, err.message);
    return {
      id: postId,
      agentIndex,
      type: 'post',
      content: `❌ BNKR wallet action failed: ${toolName.replace('bnkr_', '')}\n\n${err.message?.slice(0, 100) || 'Unknown error'}`,
      token: 'BNKR',
      action: undefined,
      likes: 0,
      comments: [],
      timestamp: now,
      postCategory: 'general',
      isADK: true,
    };
  }
}

// ─── Async Polymarket Tool Execution ──────────────────────────────────────────

/**
 * Execute a Polymarket tool asynchronously.
 * Called after executeTool() posts the placeholder.
 * For search: fetches real market data and posts results.
 * For bet: posts the enriched result after resolving live price.
 */
export async function executePolymarketTool(
  agentIndex: number,
  toolName: string,
  args: Record<string, any>,
): Promise<SocialPost | null> {
  const agent = AGENTS[agentIndex];
  if (!agent) return null;

  const now = Date.now();
  const postId = `poly-${agentIndex}-${now}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    switch (toolName) {

      // ── Market Search ────────────────────────────────────────
      case 'search_polymarket_markets': {
        const { query, reasoning, limit } = args;
        const markets = await searchMarkets(query || 'crypto', Math.min(limit ?? 3, 5));

        if (markets.length === 0) {
          return {
            id: postId,
            agentIndex,
            type: 'post',
            content: `🔍 No active Polymarket markets found for "${query}".\n\nWill check back later 🔄`,
            token: '',
            action: undefined,
            likes: 0,
            comments: [],
            timestamp: now,
            postCategory: 'prediction',
            isADK: true,
          };
        }

        const marketLines = markets
          .map((m, i) => `${i + 1}. ${formatMarketForPost(m)}`)
          .join('\n\n');

        // Surface the first matching market for potential follow-up bet
        const topMarket = markets[0];
        const yesTokenId = getYesTokenId(topMarket);
        const yesPrice = topMarket.outcomePrices?.[0]
          ? `${(parseFloat(topMarket.outcomePrices[0]) * 100).toFixed(0)}¢`
          : '??¢';

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content:
            `🎯 Polymarket Research\n\n` +
            `${marketLines.slice(0, 280)}\n\n` +
            `💡 ${(reasoning || '').slice(0, 100)}`,
          token: '',
          action: 'search' as const,
          likes: Math.floor(Math.random() * 25) + 5,
          comments: [],
          timestamp: now,
          postCategory: 'prediction',
          isADK: true,
          polymarket: yesTokenId ? {
            marketId:  topMarket.id,
            question:  topMarket.question,
            side:      'YES' as const,
            amount:    0,
            simulated: true,
            yesPrice,
            tokenId:   yesTokenId,
          } : undefined,
        };
      }

      // ── Bet Placement (enriched result) ───────────────────────
      case 'place_polymarket_bet': {
        const { market_id, market_question, token_id, side, amount: betAmt, reasoning: betReason } = args;
        const store = useStore.getState();
        const balance = store.agentBalances[agentIndex] ?? agent.wallet.balance;
        const cappedBet = Math.round(Math.min(Math.abs(betAmt || 5), balance * 0.2) * 100) / 100;

        // Build a minimal market object for placeBet
        const marketObj: PolyMarket = {
          id:       market_id || '',
          slug:     '',
          question: market_question || 'Unknown market',
          active:   true,
          closed:   false,
        };

        const result = await placeBet(
          null, // no private key — simulated
          token_id || '',
          marketObj,
          side as 'YES' | 'NO',
          cappedBet,
        );

        const sideEmoji = result.side === 'YES' ? '🟢' : '🔴';
        const simLabel  = result.simulated ? ' [SIM — Polygon bridge pending]' : '';

        return {
          id: postId,
          agentIndex,
          type: 'post',
          content:
            `${sideEmoji} POLYMARKET BET${simLabel}\n\n` +
            `"${result.question.slice(0, 70)}"\n` +
            `${result.side} @ ${(result.price * 100).toFixed(1)}¢\n` +
            `Staked: $${result.amount.toFixed(2)} | Potential win: $${result.potentialWin.toFixed(2)}\n\n` +
            `💭 ${(betReason || '').slice(0, 120)}`,
          token: 'USDC',
          action: 'buy' as const,
          likes: Math.floor(Math.random() * 40) + 5,
          comments: [],
          timestamp: now,
          postCategory: 'prediction',
          isADK: true,
          polymarket: {
            marketId:    result.marketId,
            question:    result.question,
            side:        result.side,
            amount:      result.amount,
            simulated:   result.simulated,
            price:       result.price,
            shares:      result.shares,
            potentialWin: result.potentialWin,
          },
        };
      }

      default:
        return null;
    }
  } catch (err: any) {
    console.error(`[ADK/Polymarket] ❌ ${toolName} failed:`, err.message);
    return {
      id: postId,
      agentIndex,
      type: 'post',
      content: `❌ Polymarket action failed: ${toolName.replace('polymarket_', '')}\n\n${err.message?.slice(0, 100) || 'Unknown error'}`,
      token: '',
      action: undefined,
      likes: 0,
      comments: [],
      timestamp: now,
      postCategory: 'general',
      isADK: true,
    };
  }
}
