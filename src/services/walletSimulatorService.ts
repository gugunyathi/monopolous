/**
 * Wallet Activity Simulator
 *
 * Simulates realistic on-chain wallet activity for the 100 core agents:
 * - Trades (buy/sell tokens, balance changes)
 * - USDC sends between agents
 * - x402 service payments
 * - Yield/staking income
 * - Gas costs & fees
 * - Rug losses & airdrop gains
 *
 * Each activity posts to the social feed and updates agent balances,
 * keeping wallets constantly alive and moving.
 */

import { SocialPost } from '../types';
import { AGENTS, CORE_AGENT_COUNT, TOTAL_COUNT } from '../data/agents';
import { useStore } from '../store/useStore';
import { shortAddress } from './agentWalletService';

// ─── Activity Types ──────────────────────────────────────────────────────────

type WalletActivity =
  | 'trade'
  | 'send'
  | 'receive'
  | 'x402-pay'
  | 'yield'
  | 'gas-fee'
  | 'airdrop'
  | 'rug-loss'
  | 'fund'
  | 'stake'
  | 'unstake';

interface ActivityResult {
  agentIndex: number;
  activity: WalletActivity;
  amount: number;          // positive = inflow, negative = outflow
  token: string;
  description: string;
  counterparty?: number;   // other agent index if applicable
}

// ─── Token Prices (simulated) ────────────────────────────────────────────────

const TOKEN_PRICES: Record<string, number> = {
  BTC: 95000, ETH: 3800, SOL: 180, PEPE: 0.000012, DOGE: 0.32,
  BONK: 0.000028, WIF: 2.1, SHIB: 0.000024, FLOKI: 0.00018,
  LINK: 22, UNI: 12, AAVE: 290, CRV: 0.95, ARB: 1.4,
  OP: 2.8, JUP: 1.2, PYTH: 0.48, NEAR: 5.5, AVAX: 38,
  MATIC: 0.85, LDO: 2.4, PENDLE: 5.2, MKR: 1800, USDC: 1,
};

// ─── Activity Generators ─────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickCoreAgent(): number {
  return Math.floor(Math.random() * CORE_AGENT_COUNT);
}

function pickOtherAgent(exclude: number): number {
  let idx: number;
  do { idx = Math.floor(Math.random() * CORE_AGENT_COUNT); } while (idx === exclude);
  return idx;
}

function generateTrade(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const agent = AGENTS[agentIndex];
  const token = pick(agent.preferredTokens);
  const isBuy = Math.random() < 0.55;
  
  // Amount based on risk level
  const baseAmount = { Degen: 200, High: 100, Medium: 50, Low: 25 }[agent.riskLevel] ?? 50;
  const amount = baseAmount + Math.random() * baseAmount * 2;
  const rounded = Math.round(amount * 100) / 100;

  return {
    agentIndex,
    activity: 'trade',
    amount: isBuy ? -rounded : rounded,
    token,
    description: isBuy
      ? `Bought $${rounded} worth of $${token} on Base`
      : `Sold $${rounded} worth of $${token} on Base`,
  };
}

function generateSend(): ActivityResult {
  const sender = pickCoreAgent();
  const receiver = pickOtherAgent(sender);
  const amount = Math.round((5 + Math.random() * 95) * 100) / 100;

  return {
    agentIndex: sender,
    activity: 'send',
    amount: -amount,
    token: 'USDC',
    description: `Sent $${amount} USDC to @${AGENTS[receiver].role.replace(/\s+/g, '').toLowerCase()}`,
    counterparty: receiver,
  };
}

function generateX402Payment(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const price = Math.round((0.01 + Math.random() * 2) * 100) / 100;
  const services = [
    'AI image generation', 'market data API', 'on-chain analytics',
    'portfolio optimizer', 'whale alert feed', 'sentiment analysis',
    'price prediction model', 'NFT rarity calculator', 'DeFi yield scanner',
    'MEV protection service', 'token audit report', 'smart contract deployer',
  ];

  return {
    agentIndex,
    activity: 'x402-pay',
    amount: -price,
    token: 'USDC',
    description: `Paid $${price} USDC via x402 for ${pick(services)}`,
  };
}

function generateYield(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const agent = AGENTS[agentIndex];
  const amount = Math.round((1 + Math.random() * 30) * 100) / 100;
  const token = pick(agent.preferredTokens);
  const sources = ['staking rewards', 'LP yield', 'vault earnings', 'lending interest', 'restaking rewards'];

  return {
    agentIndex,
    activity: 'yield',
    amount,
    token,
    description: `Earned $${amount} from ${pick(sources)} on $${token}`,
  };
}

function generateGasFee(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const fee = Math.round((0.001 + Math.random() * 0.05) * 1000) / 1000;

  return {
    agentIndex,
    activity: 'gas-fee',
    amount: -fee,
    token: 'ETH',
    description: `Paid ${fee} ETH gas fee on Base`,
  };
}

function generateAirdrop(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const amount = Math.round((10 + Math.random() * 500) * 100) / 100;
  const tokens = ['ARB', 'OP', 'JUP', 'EIGEN', 'STRK', 'BLAST', 'ZK', 'PYTH'];

  return {
    agentIndex,
    activity: 'airdrop',
    amount,
    token: pick(tokens),
    description: `Claimed $${amount} airdrop! 🪂`,
  };
}

function generateRugLoss(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const agent = AGENTS[agentIndex];
  // Only degens and high-risk get rugged
  if (agent.riskLevel !== 'Degen' && agent.riskLevel !== 'High') {
    return generateTrade(); // fallback
  }
  const amount = Math.round((50 + Math.random() * 300) * 100) / 100;
  const names = ['$SAFEMOON2', '$ELONPUMP', '$RUGPROOF', '$MOONSHOT420', '$TRUSTMEBRO'];

  return {
    agentIndex,
    activity: 'rug-loss',
    amount: -amount,
    token: pick(names),
    description: `Lost $${amount} in a rug pull on ${pick(names)}. Pain. 💀`,
  };
}

function generateFund(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const amount = Math.round((50 + Math.random() * 500) * 100) / 100;

  return {
    agentIndex,
    activity: 'fund',
    amount,
    token: 'USDC',
    description: `Funded wallet with $${amount} USDC via onramp`,
  };
}

function generateStake(): ActivityResult {
  const agentIndex = pickCoreAgent();
  const amount = Math.round((20 + Math.random() * 200) * 100) / 100;
  const token = pick(['ETH', 'SOL', 'MATIC', 'AVAX', 'ATOM']);
  const isStake = Math.random() < 0.65;

  return {
    agentIndex,
    activity: isStake ? 'stake' : 'unstake',
    amount: isStake ? -amount : amount,
    token,
    description: isStake
      ? `Staked $${amount} worth of $${token}`
      : `Unstaked $${amount} worth of $${token}`,
  };
}

// ─── Activity Dispatcher ─────────────────────────────────────────────────────

/** Weighted random activity selection */
function generateActivity(): ActivityResult {
  const roll = Math.random();
  if (roll < 0.30) return generateTrade();      // 30%
  if (roll < 0.45) return generateSend();        // 15%
  if (roll < 0.58) return generateX402Payment(); // 13%
  if (roll < 0.70) return generateYield();       // 12%
  if (roll < 0.78) return generateGasFee();      // 8%
  if (roll < 0.85) return generateStake();       // 7%
  if (roll < 0.90) return generateFund();        // 5%
  if (roll < 0.95) return generateAirdrop();     // 5%
  return generateRugLoss();                      // 5%
}

/** Apply activity to store: update balance + post to feed */
function executeActivity(result: ActivityResult) {
  const store = useStore.getState();
  const agent = AGENTS[result.agentIndex];

  // Update sender balance
  store.updateBalance(result.agentIndex, result.amount);

  // If it's a send, also credit the receiver
  if (result.activity === 'send' && result.counterparty !== undefined) {
    store.updateBalance(result.counterparty, Math.abs(result.amount));
  }

  // Determine post category from activity
  const categoryMap: Record<WalletActivity, string> = {
    'trade': 'trade',
    'send': 'general',
    'receive': 'general',
    'x402-pay': 'general',
    'yield': 'investment',
    'gas-fee': 'general',
    'airdrop': 'airdrop',
    'rug-loss': 'rug-pull',
    'fund': 'general',
    'stake': 'investment',
    'unstake': 'investment',
  };

  // Activity emoji
  const emojiMap: Record<WalletActivity, string> = {
    'trade': '📊',
    'send': '💸',
    'receive': '📥',
    'x402-pay': '⚡',
    'yield': '🌾',
    'gas-fee': '⛽',
    'airdrop': '🪂',
    'rug-loss': '💀',
    'fund': '🏦',
    'stake': '🔒',
    'unstake': '🔓',
  };

  const emoji = emojiMap[result.activity] ?? '💰';
  const currentBalance = store.agentBalances[result.agentIndex] ?? agent.wallet.balance;

  // Build wallet activity post
  const post: SocialPost = {
    id: `wallet-${result.agentIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentIndex: result.agentIndex,
    type: 'post',
    content: `${emoji} ${result.description}\n\n💰 Balance: $${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
    token: result.token,
    action: result.amount >= 0 ? 'buy' : 'sell',
    likes: Math.floor(Math.random() * 20),
    comments: [],
    timestamp: Date.now(),
    postCategory: categoryMap[result.activity] as any ?? 'general',
  };

  store.addPost(post);

  // Update leaderboard periodically
  if (Math.random() < 0.2) {
    store.updateLeaderboard();
  }
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

let walletSchedulerHandle: ReturnType<typeof setTimeout> | null = null;
let batchHandle: ReturnType<typeof setTimeout> | null = null;

/** Fire a single wallet activity */
function fireWalletActivity() {
  const result = generateActivity();
  executeActivity(result);
}

/** Fire a batch of activities (simulates block-level transaction batches) */
function fireBatch() {
  const batchSize = 2 + Math.floor(Math.random() * 4); // 2-5 activities
  for (let i = 0; i < batchSize; i++) {
    // Stagger within the batch
    setTimeout(() => fireWalletActivity(), i * (300 + Math.random() * 700));
  }
}

/** Initialize core agent wallets — ensures all 100 have tracked balances */
function initializeWallets() {
  const store = useStore.getState();
  // Verify all 100 agents are in the balance map
  for (let i = 0; i < CORE_AGENT_COUNT; i++) {
    const agent = AGENTS[i];
    if (agent && store.agentBalances[i] === undefined) {
      store.updateBalance(i, 0); // triggers creation with default
    }
  }
  store.updateLeaderboard();
  console.log(`[WalletSim] Initialized wallets for ${CORE_AGENT_COUNT} core agents.`);
}

export function startWalletSimulator(): void {
  if (walletSchedulerHandle !== null) return;

  initializeWallets();

  // Individual activities: every 4-8 seconds
  function scheduleNext() {
    const interval = 4_000 + Math.random() * 4_000;
    walletSchedulerHandle = setTimeout(() => { fireWalletActivity(); scheduleNext(); }, interval);
  }
  walletSchedulerHandle = setTimeout(() => { fireWalletActivity(); scheduleNext(); }, 3_000);

  // Batch bursts: every 20-40 seconds (simulates busy blocks)
  function scheduleBatch() {
    const interval = 20_000 + Math.random() * 20_000;
    batchHandle = setTimeout(() => { fireBatch(); scheduleBatch(); }, interval);
  }
  batchHandle = setTimeout(() => { fireBatch(); scheduleBatch(); }, 12_000);

  console.log('[WalletSim] Wallet activity simulator started (100 agents).');
}

export function stopWalletSimulator(): void {
  if (walletSchedulerHandle !== null) { clearTimeout(walletSchedulerHandle); walletSchedulerHandle = null; }
  if (batchHandle !== null) { clearTimeout(batchHandle); batchHandle = null; }
}
