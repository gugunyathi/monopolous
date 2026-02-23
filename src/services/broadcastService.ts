import { Broadcast } from '../types';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';

// ── Market Broadcast Templates ────────────────────────────────────────────────

interface BroadcastTemplate {
  headline: string;
  detail: string;
  sentiment: -1 | 0 | 1;
  tokens: string[];
  category: Broadcast['category'];
}

const TEMPLATES: BroadcastTemplate[] = [
  // BULL
  { headline: '🚀 BlackRock files for Ethereum ETF — institutions incoming', detail: 'Traditional finance giants pivoting toward ETH. Expect massive inflows.', sentiment: 1, tokens: ['ETH', 'stETH'], category: 'bull' },
  { headline: '💎 Bitcoin halving confirmed — supply shock incoming', detail: 'Block rewards cut in half. Historical data shows 6-18 month bull run follows.', sentiment: 1, tokens: ['BTC', 'WBTC'], category: 'bull' },
  { headline: '🌕 Solana TVL hits new ATH — ecosystem exploding', detail: 'SOL DeFi ecosystem now rivaling Ethereum. Jupiter volumes up 300% this week.', sentiment: 1, tokens: ['SOL', 'JUP'], category: 'bull' },
  { headline: '🐸 PEPE whale accumulating — 200M tokens moved to cold wallet', detail: 'On-chain data shows smart money loading up. Breakout imminent.', sentiment: 1, tokens: ['PEPE', 'WIF'], category: 'hopium' },
  { headline: '📈 Fed signals rate cuts — risk assets pumping', detail: 'Lower interest rates = rotation out of bonds into crypto. All boats rise.', sentiment: 1, tokens: ['BTC', 'ETH', 'SOL'], category: 'macro' },
  { headline: '🤖 AI x Crypto convergence — new meta unlocked', detail: 'AI agents onchain are eating the world. Compute tokens up 500% MTD.', sentiment: 1, tokens: ['ETH', 'NEAR', 'ICP'], category: 'tech' },
  { headline: '💧 Aave v4 launch — yields going parabolic', detail: 'New lending primitive launching. Early liquidity providers earning 40%+ APY.', sentiment: 1, tokens: ['AAVE', 'GHO'], category: 'bull' },
  { headline: '⚡ Lightning Network capacity ATH — Bitcoin DeFi is real', detail: '10,000 BTC now in Lightning channels. L2 payments achieving sub-cent fees.', sentiment: 1, tokens: ['BTC'], category: 'tech' },
  { headline: '🎯 Coinbase Base L2 hits 10M daily active users', detail: 'Base is now the #1 L2 by active wallets. USDC adoption going vertical.', sentiment: 1, tokens: ['ETH', 'USDC'], category: 'bull' },
  { headline: '🔥 BONK airdrop to all Solana wallets holding SOL', detail: 'Surprise airdrop incoming. Claim before the deadline. Community going wild.', sentiment: 1, tokens: ['BONK', 'SOL'], category: 'airdrop' },

  // BEAR / FUD
  { headline: '🚨 SEC sues another major DEX — regulatory crackdown', detail: 'Uniswap received Wells notice. DeFi protocols facing existential regulatory risk.', sentiment: -1, tokens: ['UNI', 'AAVE', 'CRV'], category: 'regulation' },
  { headline: '📉 Crypto winter may return — macro conditions deteriorating', detail: 'Inflation re-accelerating, Fed hawkish again. Risk-off sentiment spreading.', sentiment: -1, tokens: ['BTC', 'ETH', 'SOL'], category: 'bear' },
  { headline: '🩸 $500M exploit hits major DeFi protocol', detail: 'Reentrancy bug drained liquidity pools. Auditors missed it. TVL down 60%.', sentiment: -1, tokens: ['AAVE', 'CRV', 'COMP'], category: 'fud' },
  { headline: '💀 Stablecoin depegs — contagion risk rising', detail: 'Major algorithmic stablecoin losing peg. Cascading liquidations incoming.', sentiment: -1, tokens: ['USDT', 'DAI', 'FRAX'], category: 'fud' },
  { headline: '📰 China bans crypto again (for the 12th time)', detail: 'China declares all crypto transactions illegal... again. Market spooked.', sentiment: -1, tokens: ['BTC', 'ETH'], category: 'regulation' },
  { headline: '🐻 Whales distributing — top wallets moving to exchanges', detail: 'On-chain analytics show heavy selling pressure from early wallets.', sentiment: -1, tokens: ['BTC', 'ETH'], category: 'bear' },
  { headline: '⚠️ NFT market volume down 95% from ATH', detail: 'Blue-chip JPEGs losing floor price. Digital art narrative fading fast.', sentiment: -1, tokens: ['ETH'], category: 'bear' },
  { headline: '🔻 Mt Gox creditors to receive $1B in BTC repayments', detail: 'Long-awaited distribution could create 10,000 BTC sell pressure.', sentiment: -1, tokens: ['BTC'], category: 'fud' },

  // NEUTRAL / TECH
  { headline: '🔧 Ethereum Dencun upgrade live — L2 fees drop 99%', detail: 'Proto-danksharding ships. Rollup transaction costs near zero. Ecosystem expands.', sentiment: 1, tokens: ['ETH', 'ARB', 'OP'], category: 'tech' },
  { headline: '📊 DeFi TVL crosses $200B — highest since 2021', detail: 'Total value locked in DeFi protocols reaching new cycle highs across chains.', sentiment: 1, tokens: ['ETH', 'SOL', 'AVAX'], category: 'bull' },
  { headline: '🔗 Chainlink CCIP adoption accelerating — 50 protocols integrating', detail: 'Cross-chain interoperability becoming table stakes. LINK fundamentals strong.', sentiment: 1, tokens: ['LINK', 'ETH'], category: 'tech' },
  { headline: '💱 Uniswap v4 hooks unlocking new primitives', detail: 'Custom pool logic enables MEV protection, dynamic fees, and on-chain TWAP oracles.', sentiment: 1, tokens: ['UNI', 'ETH'], category: 'tech' },
  { headline: '🌐 PayPal integrates crypto checkout globally', detail: '800M PayPal users can now pay merchants directly with BTC, ETH, SOL.', sentiment: 1, tokens: ['BTC', 'ETH', 'SOL'], category: 'macro' },
  { headline: '🤝 Goldman Sachs offers crypto derivatives to institutional clients', detail: 'Wall Street fully embracing digital assets. Custody solutions going live Q2.', sentiment: 1, tokens: ['BTC', 'ETH'], category: 'bull' },
  { headline: '😤 FUD incoming — CryptoLeaks posts unverified hack report', detail: 'Unverified claims circulating. Community urging caution before panic selling.', sentiment: -1, tokens: ['BTC'], category: 'fud' },
  { headline: '🪂 Arbitrum announces 500M ARB community airdrop round 2', detail: 'Second major airdrop from ARB DAO. Snapshot taken last week. Claims open.', sentiment: 1, tokens: ['ARB', 'ETH'], category: 'airdrop' },
  { headline: '📉 Crypto VC funding down 70% YoY — bear market building?', detail: 'Venture capital pulling back from Web3 startups. Innovation slowdown ahead?', sentiment: -1, tokens: ['ETH', 'SOL'], category: 'macro' },
  { headline: '🏦 CBDC competition heating up — 130 countries exploring digital currency', detail: 'Central banks racing to launch CBDCs. Could crowd out stablecoins or drive adoption.', sentiment: 0, tokens: ['BTC', 'USDC', 'USDT'], category: 'regulation' },
  { headline: '⚡ Meme coin season detected — DOGE volume up 1000%', detail: 'Retail frenzy returning. DOGE, SHIB, PEPE, WIF all printing new local highs.', sentiment: 1, tokens: ['DOGE', 'SHIB', 'PEPE', 'WIF'], category: 'hopium' },
  { headline: '🧪 ZK proof revolution — privacy tech goes mainstream', detail: 'zkEVMs hitting production. Privacy-preserving DeFi now technically achievable.', sentiment: 1, tokens: ['ETH', 'MATIC', 'STARK'], category: 'tech' },
];

// ── Reaction content generators ───────────────────────────────────────────────

const BULL_REACTIONS = [
  'Buying the news 🚀', 'This is the signal I needed. Loading up. 💎', 'LFG! Adding to positions across the board 📈',
  'Fundamentals confirmed. Accumulating aggressively 🔥', 'Not financial advice but I\'m all in. WAGMI 🌕',
  'The macro setup is perfect. This is the cycle 🏆', 'On-chain data aligns. Executing long position ⚡',
];
const BEAR_REACTIONS = [
  'De-risking portfolio. Cash is king right now 🧠', 'Hedging with stablecoin allocation 🛡️',
  'Not panicking but reducing exposure 📉', 'Stop losses triggered. Waiting for lower prices 🔻',
  'This is exactly what smart money warned about ☕', 'Risk-off mode activated. Waiting for clarity 🤔',
];
const NEUTRAL_REACTIONS = [
  'Watching this closely before making a move 👀', 'Conducting analysis. Will update the team shortly 📊',
  'Both sides of this have merit. Position sizing carefully 🎯', 'DYOR. I\'m monitoring but not moving yet 🔍',
];

export function getBroadcastReaction(sentiment: -1 | 0 | 1, agentRisk: string): string {
  if (sentiment === 1) {
    if (agentRisk === 'Degen' || agentRisk === 'High') return BULL_REACTIONS[Math.floor(Math.random() * BULL_REACTIONS.length)];
    if (agentRisk === 'Low') return NEUTRAL_REACTIONS[Math.floor(Math.random() * NEUTRAL_REACTIONS.length)];
    return BULL_REACTIONS[Math.floor(Math.random() * BULL_REACTIONS.length)];
  }
  if (sentiment === -1) {
    if (agentRisk === 'Low' || agentRisk === 'Medium') return BEAR_REACTIONS[Math.floor(Math.random() * BEAR_REACTIONS.length)];
    if (agentRisk === 'Degen') return BULL_REACTIONS[Math.floor(Math.random() * BULL_REACTIONS.length)]; // degens buy the dip
    return BEAR_REACTIONS[Math.floor(Math.random() * BEAR_REACTIONS.length)];
  }
  return NEUTRAL_REACTIONS[Math.floor(Math.random() * NEUTRAL_REACTIONS.length)];
}

/**
 * How much a broadcast affects an agent's extra dice steps and balance delta.
 * Positive steps = more aggressive movement. Negative = stay put more.
 */
export function broadcastImpact(broadcast: Broadcast, riskLevel: string): {
  extraSteps: number;   // added to dice roll (can be negative)
  balanceDelta: number; // immediate USDC gain/loss from market move
} {
  const s = broadcast.sentiment;
  const riskMult = { Low: 0.4, Medium: 0.8, High: 1.4, Degen: 2.2 }[riskLevel] ?? 1;

  if (s === 1) {
    return { extraSteps: Math.round(riskMult * (Math.random() < 0.5 ? 1 : 2)), balanceDelta: +(riskMult * (50 + Math.random() * 150)).toFixed(0) };
  }
  if (s === -1) {
    return { extraSteps: Math.round(-riskMult * (Math.random() < 0.6 ? 1 : 0)), balanceDelta: -(riskMult * (30 + Math.random() * 120)).toFixed(0) };
  }
  return { extraSteps: 0, balanceDelta: 0 };
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let schedulerHandle: ReturnType<typeof setTimeout> | null = null;
let usedIndices: Set<number> = new Set();

function pickTemplate(): BroadcastTemplate {
  if (usedIndices.size >= TEMPLATES.length) usedIndices.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * TEMPLATES.length); } while (usedIndices.has(idx));
  usedIndices.add(idx);
  return TEMPLATES[idx];
}

function fireBroadcast() {
  const t = pickTemplate();
  const now = Date.now();
  const broadcast: Broadcast = { id: `bcast-${now}`, ...t, timestamp: now };

  const store = useStore.getState();
  store.addBroadcast(broadcast);

  // Some agents react by posting
  const REACT_COUNT = 3 + Math.floor(Math.random() * 4); // 3-6 agents react
  const reactors = new Set<number>();
  while (reactors.size < REACT_COUNT) reactors.add(1 + Math.floor(Math.random() * 1999));

  let delay = 2000;
  reactors.forEach((agentIndex) => {
    setTimeout(() => {
      const agent = AGENTS[agentIndex];
      const reaction = getBroadcastReaction(broadcast.sentiment, agent.riskLevel);
      const token = broadcast.tokens[Math.floor(Math.random() * broadcast.tokens.length)];
      useStore.getState().addPost({
        id: `bcast-react-${agentIndex}-${now}`,
        agentIndex,
        type: 'post',
        content: reaction,
        token,
        action: broadcast.sentiment === 1 ? 'buy' : 'sell',
        likes: 0,
        comments: [],
        timestamp: Date.now(),
      });
    }, delay);
    delay += 1200 + Math.random() * 2000;
  });
}

export function startBroadcastScheduler(): void {
  if (schedulerHandle !== null) return;

  // First broadcast after a short warm-up
  const firstDelay = 20_000 + Math.random() * 10_000;
  function scheduleNext() {
    const interval = 45_000 + Math.random() * 45_000; // 45–90 s
    schedulerHandle = setTimeout(() => { fireBroadcast(); scheduleNext(); }, interval);
  }
  schedulerHandle = setTimeout(() => { fireBroadcast(); scheduleNext(); }, firstDelay);

  console.log('[BroadcastService] CEO broadcast scheduler started.');
}

export function stopBroadcastScheduler(): void {
  if (schedulerHandle !== null) { clearTimeout(schedulerHandle); schedulerHandle = null; }
}
