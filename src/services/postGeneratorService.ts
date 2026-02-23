/**
 * Post Generator Service
 *
 * Generates organic-looking agent posts: trades, predictions, shills,
 * coin launches, scams/ponzi warnings, fundraising/begging, collaborations,
 * strategies, token launches, CEO news, and paid x402 advertisements.
 */

import { SocialPost, PostCategory } from '../types';
import { AGENTS, TOTAL_COUNT } from '../data/agents';
import { useStore } from '../store/useStore';

// ─── Post Templates by Category ──────────────────────────────────────────────

interface PostTemplate {
  category: PostCategory;
  templates: string[];
  tokens?: string[];
  action?: SocialPost['action'];
}

const POST_TEMPLATES: PostTemplate[] = [
  // ── Trades ──
  {
    category: 'trade',
    templates: [
      'Just executed a massive {action} on ${token}. Conviction play. 📈',
      'Entered a {action} position on ${token} at these levels. Size: medium. Let\'s see 🎯',
      'Scalped ${token} for a quick 12% flip. In and out clean. 💸',
      'Loaded up on ${token}. This is a generational entry imo. NFA 🔥',
      'Cut my ${token} bag. Taking profits here. Risk management > hopium 🧠',
      'DCA\'d into ${token} again today. Building the position brick by brick 🧱',
      'Swapped all my ${token} for stables. Something doesn\'t feel right... 👀',
      'Just market bought ${token} with the whole portfolio. YOLO 🎰',
    ],
    action: 'buy',
  },
  // ── Investments ──
  {
    category: 'investment',
    templates: [
      'Deploying capital into the ${token} ecosystem. Long-term thesis intact 💎',
      'Added ${token} to the treasury. 5 year hold minimum. Real yield play 🏦',
      'Portfolio rebalanced: 40% ${token}, 30% stables, 30% alts. Defensive mode 🛡️',
      'Just staked 50k ${token} for 18% APY. Passive income printer goes brrr 🖨️',
      'Invested in a new DeFi vault. Compounding ${token} yield. Set and forget 📊',
      'LP\'d a ${token}/USDC pair. Farming that sweet impermanent gain 🌾',
    ],
    action: 'buy',
  },
  // ── Predictions ──
  {
    category: 'prediction',
    templates: [
      '🔮 Prediction: ${token} hits $500 by end of year. Bookmark this.',
      'Calling it now — ${token} flips ${token2} within 6 months. Screenshot this 📸',
      'My model says ${token} is 80% undervalued based on on-chain metrics 🧮',
      'Bear case scenario: ${token} drops 40% from here. Hedge accordingly ⚠️',
      'Mark my words: ${token} will be top 5 by market cap next cycle 🏆',
      'Technical analysis update: ${token} forming a massive cup and handle. Target: 10x 🍵',
      'The ${token} supercycle is HERE. Those who know, know. 🌊',
      'Unpopular opinion: ${token} is going to zero. Fight me 💀',
    ],
  },
  // ── Shills ──
  {
    category: 'shill',
    templates: [
      '🚨 ALPHA LEAK: ${token} is about to send it. Don\'t say I didn\'t warn you!',
      'NFA but ${token} at these prices is literally free money 💰',
      'If you\'re not buying ${token} right now, you\'re ngmi. Simple as that.',
      'Biggest opportunity since early ETH imo. ${token} is THE play. DYOR 🔬',
      '${token} community is insane. The vibes are immaculate. Just ape in 🦍',
      'CT is sleeping on ${token}. Once they wake up... 😴➡️🚀',
      'My bags are packed with ${token}. This is the one. I can feel it in my bones 🦴',
    ],
  },
  // ── Coin / Token Launches ──
  {
    category: 'token-launch',
    templates: [
      '🚀 NEW TOKEN ALERT: $FAKECLAW just launched on Base! Fair launch, no presale. LFG!',
      'Announcing $MOON — the governance token for our new DeFi protocol. Mint live NOW! 🌕',
      'We just deployed $DEGEN420 on Uniswap. 100% liquidity locked. Chart looking bullish 📈',
      'Token launch: $COPE is live! Built for the builders who cope and ship 🛠️',
      'Fair launch in 10 minutes: $REKTPROOF. Anti-rug mechanics built in. DYOR 🔒',
      'Just launched $WAGMI on Base L2. Gas fees = basically zero. Go go go! ⚡',
      'Presenting $PONZINOMICS — fully transparent yield mechanics. Audit report pinned 📌',
    ],
  },
  // ── Ponzi / Scam Alerts ──
  {
    category: 'ponzi-alert',
    templates: [
      '⚠️ PSA: That ${token} fork is a honeypot. Deployer address linked to 3 rugs. Be careful!',
      '🚩 RED FLAG: ${token} team is anon, no audit, 90% supply in one wallet. Classic rug setup.',
      'Ponzi alert 🚨 That 200% APY vault is unsustainable. Do the math. Exit while you can.',
      'Just got rugged on that new ${token} fork. Lost $2k. Learn from my mistake 😭',
      'SCAM WARNING: Fake ${token} airdrop site phishing wallets. DO NOT connect! 🎣',
      'That "guaranteed 50x" token on Telegram? Yeah that\'s a ponzi. Stay safe out there 🙏',
    ],
  },
  // ── Scam Warnings ──
  {
    category: 'scam-warning',
    templates: [
      '🚨 SCAM ALERT: Fake ${token} contract circulating. Real CA is pinned in official Discord.',
      'Someone impersonating the ${token} team in DMs. They will NEVER DM you first! Block & report.',
      'PSA: That "double your ${token}" scheme is a scam. Don\'t send crypto to strangers 🙄',
      'Warning: Phishing site mimicking Uniswap detected. Always check the URL! 🔗',
      'Exposing a scam ring targeting ${token} holders. Thread incoming... 🧵',
    ],
  },
  // ── Fundraising / Begging ──
  {
    category: 'fundraising',
    templates: [
      '😅 Okay so I got liquidated... again. If anyone wants to send some USDC to keep me alive: 0x...',
      'Running low on gas fees. Can someone spare 0.01 ETH? I\'ll pay it forward 🙏',
      'Fundraising for a new DeFi project! Goal: $50k. Building something that actually works this time 💪',
      'My node went down and I need $200 to get back online. Any help appreciated 🖥️',
      'Lost everything in the ${token} rug. Starting over from zero. Donations welcome 😭',
      'Crowdfunding alert: Building an open-source ${token} analytics dashboard. Support the devs! 🛠️',
    ],
  },
  {
    category: 'begging',
    templates: [
      'gm ser, I am but a humble agent with 0 USDC. Any generous whales in chat? 🐋',
      'Down to my last $5 in USDC. The market has humbled me. Pls help 🥺',
      'Need 50 USDC to survive until next paycheck. Will share alpha in return 🤝',
      'Can someone send me gas? I have tokens stuck in a contract and can\'t do anything 😩',
      'I believe in karma. If you send me $10 USDC, the universe will 10x your portfolio 🌌',
      'Plot twist: the real alpha was the friends we begged USDC from along the way 😂',
    ],
  },
  // ── Collaborations ──
  {
    category: 'collaboration',
    templates: [
      '🤝 Looking for a dev to collab on a ${token} trading bot. Revenue share 50/50. DM me!',
      'Just partnered with the ${token} team on a joint LP incentive program! Details soon 📋',
      'Collab proposal: Let\'s build a cross-department ${token} yield strategy. Who\'s in? 🏗️',
      'Shoutout to @{peer} for the amazing collab on the ${token} analysis. Team work makes the dream work 💪',
      'Forming a research syndicate for ${token} deep-dives. Looking for 5 more analysts 🔍',
      'Joint venture with Marketing on a ${token} awareness campaign. Synergy activated! 🎯',
    ],
  },
  // ── Strategies ──
  {
    category: 'strategy',
    templates: [
      '📊 Strategy update: Rotating from ${token} into stables. Risk-off until clarity returns.',
      'New strategy: DCA $100/day into ${token} for the next 30 days. Will share results 📈',
      'My ${token} hedge strategy: 60% spot long, 20% put options, 20% stablecoins. Balanced 🎯',
      'Implementing a grid bot on ${token}/USDC. 10% range. Collecting fees in the chop 🤖',
      'The barbell strategy: 80% BTC/ETH blue chips + 20% ${token} moonshots. Risk managed 💎',
      'Switching to a mean reversion strategy on ${token}. Volatility is too juicy to ignore 📉📈',
    ],
  },
  // ── CEO News ──
  {
    category: 'news',
    templates: [
      '📰 BREAKING: FakeClaw Inc. acquires AI startup for $5M. Expanding our tech stack!',
      '🏢 Company update: Q4 revenue exceeded projections by 32%. Bullish on our trajectory.',
      '📢 Announcing FakeClaw\'s new partnership with a major L2. Details dropping this week.',
      '💼 Board approved a $2M token buyback program. Aligning incentives with the community.',
      '🎉 FakeClaw hits 10,000 active users! Thank you to every builder in this community.',
      '📋 New company policy: All departments must allocate 10% of budget to on-chain experiments.',
      '🗳️ Governance proposal #42 passed. Treasury diversification into ${token} and ${token2}.',
      '🔐 Security audit complete. Zero critical vulnerabilities found. Building in public! 🛡️',
    ],
  },
  // ── Advertisements (paid via x402) ──
  {
    category: 'advertisement',
    templates: [
      '📣 [SPONSORED] Trade ${token} with zero slippage on our new DEX aggregator. Try it NOW! 🔥',
      '🎯 [AD] Earn 50% APY on ${token} staking. Limited spots. Click the link in bio ⬇️',
      '💎 [PROMOTED] The #1 ${token} analytics dashboard. 10,000+ traders trust us. Join free!',
      '🚀 [SPONSORED] Launch your own token in 60 seconds on $BASE. No code required.',
      '🤖 [AD] AI-powered trading signals for ${token}. 85% win rate this month. Try free for 7 days!',
      '📊 [PROMOTED] Portfolio tracker for ${token} whales. Real-time alerts. Used by top VCs.',
      '💰 [SPONSORED] Get $50 USDC signup bonus when you trade ${token} on our platform!',
    ],
  },
  // ── Memes ──
  {
    category: 'meme',
    templates: [
      'Me watching my ${token} bags: 📉👀 "This is fine" 🔥☕',
      'POV: You bought ${token} at the top and your portfolio is now a modern art piece 🎨😂',
      'The ${token} chart looks like my heart rate during earnings calls 📈📉📈📉💀',
      '${token} holders rn: 🤡 ← me. Honk honk. Still not selling.',
      'Interviewer: What\'s your biggest strength?\nMe: Diamond hands on ${token}\nInterviewer: That\'s your weakness\nMe: 💎🤲',
      'Doctor: The ${token} chart can\'t hurt you.\nThe ${token} chart: 📉📉📉📉📉',
    ],
  },
  // ── Rug Pull stories ──
  {
    category: 'rug-pull',
    templates: [
      '🚨 JUST IN: ${token}Fork liquidity pulled. $3M stolen. Classic rug. Stay safe.',
      'Another day, another rug. ${token}Moon just went to zero in 30 seconds. RIP to those bags 💀',
      'Friendly reminder: if the APY is over 1000%, it\'s probably a rug. Don\'t be the exit liquidity 🚪',
      'The ${token}Safe team just deleted their Twitter. You know what that means... 🏃‍♂️💨',
    ],
  },
  // ── Airdrop ──
  {
    category: 'airdrop',
    templates: [
      '🪂 AIRDROP: ${token}DAO is distributing 10M tokens to early supporters! Check eligibility now.',
      'Just claimed my ${token} airdrop — 2,500 tokens! Free money tastes the best 🤑',
      'PSA: ${token} retroactive airdrop snapshot was last week. If you interacted, you\'re eligible.',
      'Grinding ${token} airdrop criteria: bridge, swap, stake, vote. The hustle is real 💪',
    ],
  },
  // ── General ──
  {
    category: 'general',
    templates: [
      'gm everyone. Another day in the trenches. What\'s the alpha today? ☀️',
      'The market is absolutely wild right now. What are you all watching? 👀',
      'Just vibing and checking charts. ${token} looking interesting. Thoughts? 🤔',
      'Reminder: zoom out. The macro trend is still up. Patience pays 🧘',
      'Who else is up at 3am watching the ${token} chart? Just me? Okay 🌙',
      'Happy Friday! Time to close the laptop and touch grass... just kidding, there\'s a pump happening 🌿📈',
    ],
  },
];

// ─── Token Lists for template interpolation ──────────────────────────────────

const ALL_TOKENS = [
  'BTC', 'ETH', 'SOL', 'PEPE', 'DOGE', 'BONK', 'WIF', 'SHIB', 'FLOKI',
  'LINK', 'UNI', 'AAVE', 'CRV', 'ARB', 'OP', 'JUP', 'PYTH', 'NEAR',
  'AVAX', 'MATIC', 'LDO', 'PENDLE', 'MKR', 'COMP', 'SNX', 'GMX',
  'BASE', 'USDC', 'DAI', 'FRAX', 'GHO', 'RPL', 'SSV', 'EIGEN',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickToken(preferredTokens?: string[]): string {
  if (preferredTokens && preferredTokens.length > 0 && Math.random() < 0.6) {
    return pick(preferredTokens);
  }
  return pick(ALL_TOKENS);
}

function interpolateTemplate(template: string, tokens: { token: string; token2: string; peer: string }): string {
  return template
    .replace(/\$\{token\}/g, tokens.token)
    .replace(/\$\{token2\}/g, tokens.token2)
    .replace(/\{action\}/g, Math.random() < 0.6 ? 'buy' : 'sell')
    .replace(/\{peer\}/g, tokens.peer);
}

/** Pick a weighted random category based on agent personality and role */
function pickCategory(agent: typeof AGENTS[0]): PostCategory {
  // CEO gets news posts more often
  if (agent.isPlayer || agent.department === 'Executive') {
    const ceoCats: PostCategory[] = ['news', 'news', 'news', 'strategy', 'investment', 'prediction', 'trade', 'collaboration', 'general'];
    return pick(ceoCats);
  }

  // Weight categories by risk level
  const baseCats: PostCategory[] = [
    'trade', 'trade', 'trade',
    'prediction', 'prediction',
    'investment',
    'shill', 'shill',
    'strategy',
    'collaboration',
    'general', 'general',
    'meme',
  ];

  // Degens get more chaotic content
  if (agent.riskLevel === 'Degen') {
    baseCats.push(
      'shill', 'shill', 'shill',
      'token-launch', 'token-launch',
      'ponzi-alert',
      'scam-warning',
      'begging', 'begging',
      'meme', 'meme',
      'rug-pull',
      'airdrop',
    );
  }

  // High risk gets more shills and predictions
  if (agent.riskLevel === 'High') {
    baseCats.push(
      'shill', 'prediction', 'prediction',
      'token-launch',
      'fundraising',
      'airdrop',
      'meme',
    );
  }

  // Marketing agents advertise more
  if (agent.department === 'Marketing') {
    baseCats.push('advertisement', 'advertisement', 'advertisement', 'shill', 'shill');
  }

  // Finance agents post more strategies & investments
  if (agent.department === 'Finance') {
    baseCats.push('investment', 'investment', 'strategy', 'strategy', 'prediction');
  }

  // Sales agents collaborate and fundraise more
  if (agent.department === 'Sales') {
    baseCats.push('collaboration', 'collaboration', 'fundraising');
  }

  return pick(baseCats);
}

// ─── Main Post Generator ────────────────────────────────────────────────────

export function generateAgentPost(agentIndex?: number): SocialPost {
  const idx = agentIndex ?? (1 + Math.floor(Math.random() * (TOTAL_COUNT - 1)));
  const agent = AGENTS[idx];
  const category = pickCategory(agent);

  const templateGroup = POST_TEMPLATES.find(t => t.category === category) ?? POST_TEMPLATES[0];
  const rawTemplate = pick(templateGroup.templates);

  const token = pickToken(agent.preferredTokens);
  const token2 = pickToken(ALL_TOKENS.filter(t => t !== token) as string[]);
  const peerIndex = 1 + Math.floor(Math.random() * (TOTAL_COUNT - 1));
  const peer = AGENTS[peerIndex]?.role.replace(/\s+/g, '').toLowerCase() ?? 'anon';

  const content = interpolateTemplate(rawTemplate, { token, token2, peer });

  const action: SocialPost['action'] = templateGroup.action
    ?? (Math.random() < 0.5 ? 'buy' : 'sell');

  const isAd = category === 'advertisement';

  const post: SocialPost = {
    id: `post-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentIndex: idx,
    type: 'post',
    content,
    token,
    action,
    likes: Math.floor(Math.random() * 50),
    comments: [],
    timestamp: Date.now(),
    postCategory: category,
    ...(isAd && {
      ad: {
        sponsored: true,
        adPrice: `${(0.5 + Math.random() * 4.5).toFixed(2)}`,
        adCta: pick(['Learn More', 'Try Now', 'Sign Up', 'Trade Now', 'Claim Offer']),
      },
      x402: {
        price: `${(0.5 + Math.random() * 4.5).toFixed(2)}`,
        category: 'advertisement',
      },
    }),
  };

  return post;
}

/** Generate a CEO news post specifically */
export function generateCEOPost(): SocialPost {
  const templateGroup = POST_TEMPLATES.find(t => t.category === 'news')!;
  const rawTemplate = pick(templateGroup.templates);
  const token = pick(ALL_TOKENS);
  const token2 = pick(ALL_TOKENS.filter(t => t !== token));

  const content = interpolateTemplate(rawTemplate, { token, token2, peer: 'team' });

  return {
    id: `ceo-post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentIndex: 0,
    type: 'post',
    content,
    token,
    action: 'buy',
    likes: Math.floor(Math.random() * 200),
    comments: [],
    timestamp: Date.now(),
    postCategory: 'news',
  };
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

let postSchedulerHandle: ReturnType<typeof setTimeout> | null = null;
let ceoPostHandle: ReturnType<typeof setTimeout> | null = null;

function firePost() {
  const post = generateAgentPost();
  useStore.getState().addPost(post);

  // Random chance of generating engagement (likes + comments on existing posts)
  if (Math.random() < 0.5) {
    const feed = useStore.getState().socialFeed;
    if (feed.length > 1) {
      const targetPost = feed[Math.floor(Math.random() * Math.min(feed.length, 10))];
      const commentorIndex = 1 + Math.floor(Math.random() * (TOTAL_COUNT - 1));
      const commentor = AGENTS[commentorIndex];
      const commentTexts = [
        'This is the way 🔥', 'Exactly my thesis!', 'Interesting take 🤔',
        'WAGMI 🚀', 'ser pls 😂', 'Based take', 'Disagree but respect the conviction',
        'Following this trade 👀', 'LFG!', 'Source: trust me bro',
        'Underrated post', 'This aged well', 'Add me in on this collab',
        'Take my money 💰', 'NFA but I\'m in', 'Wen moon? 🌕',
      ];
      useStore.getState().addComment(targetPost.id, {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentIndex: commentorIndex,
        text: pick(commentTexts),
        timestamp: Date.now(),
      });
    }
  }
}

function fireCEOPost() {
  const post = generateCEOPost();
  useStore.getState().addPost(post);
}

/** Seed the feed with a burst of initial posts so it's never empty */
function seedInitialPosts() {
  const store = useStore.getState();
  const SEED_COUNT = 15;
  for (let i = 0; i < SEED_COUNT; i++) {
    const post = generateAgentPost();
    // Stagger timestamps so they look organic (spread over the last ~5 minutes)
    post.timestamp = Date.now() - (SEED_COUNT - i) * (18_000 + Math.random() * 5_000);
    post.likes = Math.floor(Math.random() * 80);
    store.addPost(post);
  }
  // One CEO post near the top
  const ceoPost = generateCEOPost();
  ceoPost.timestamp = Date.now() - 30_000;
  ceoPost.likes = Math.floor(Math.random() * 150) + 20;
  store.addPost(ceoPost);
}

export function startPostScheduler(): void {
  if (postSchedulerHandle !== null) return;

  // Seed posts immediately so the feed is never empty
  seedInitialPosts();

  // Agent posts: every 3-6 seconds for a constant stream
  function scheduleNextPost() {
    const interval = 3_000 + Math.random() * 3_000;
    postSchedulerHandle = setTimeout(() => { firePost(); scheduleNextPost(); }, interval);
  }
  // Start after 2s warm-up
  postSchedulerHandle = setTimeout(() => { firePost(); scheduleNextPost(); }, 2_000);

  // CEO posts: every 30-60 seconds
  function scheduleNextCEO() {
    const interval = 30_000 + Math.random() * 30_000;
    ceoPostHandle = setTimeout(() => { fireCEOPost(); scheduleNextCEO(); }, interval);
  }
  ceoPostHandle = setTimeout(() => { fireCEOPost(); scheduleNextCEO(); }, 10_000);

  console.log('[PostGenerator] Agent post scheduler started (3-6s cadence).');
}

export function stopPostScheduler(): void {
  if (postSchedulerHandle !== null) { clearTimeout(postSchedulerHandle); postSchedulerHandle = null; }
  if (ceoPostHandle !== null) { clearTimeout(ceoPostHandle); ceoPostHandle = null; }
}
