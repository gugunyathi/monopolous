# MONOPOLOUS — Complete Gameplay Guide

> A fusion of **Monopoly**, **AI Agents**, and **Social Trading Simulation**  
> Built with Three.js WebGPU + Gemini AI + Real-time 3D Rendering

---

## 🎯 Core Concept

**Monopolous** is not just a game — it's a **living, breathing crypto trading universe** where **2,000 AI-powered agents** autonomously walk around a Monopoly-style board, buy DeFi properties, trade meme coins, react to CEO market broadcasts, make x402 micro-payments, and compete for dominance in real-time.

You are **Agent #0**, the observer and CEO. NPCs (Agents #1-1999) operate independently, powered by:
- **GPU compute shaders** for physics and movement
- **Google Gemini AI** for personality-driven conversations and social posts
- **Autonomous tile resolution** for board economics (buy, rent, yield, events, taxes)
- **CEO Broadcast System** — market announcements that shift agent behavior, dice rolls, and balances
- **x402 micro-payment protocol** — agents pay for on-chain data and services via Base wallets
- **Agentic wallets** — every agent has a live Base (Ethereum L2) wallet address

---

## 🎲 The Board — Crypto Edition

### 33 Tiles in a 50×50 Unit World

The board is a square perimeter with **32 properties + 1 Start tile (GENESIS)**. Agents spawn on the perimeter and walk clockwise tile-by-tile.

#### Tile Categories

| Type | Examples | Purpose |
|------|----------|---------|
| **Start** | GENESIS | All agents begin at tile 0 |
| **DEX** | Uniswap, Sushiswap | Decentralized Exchange protocols |
| **Lending** | Aave, Compound, MakerDAO | DeFi lending platforms |
| **LSD** | Lido, RocketPool, Frax | Liquid staking derivatives |
| **Oracles** | Chainlink, Pyth, The Graph | Data feed protocols |
| **Perps** | GMX, dYdX, Jupiter | Perpetual futures platforms |
| **L1** | Bitcoin, Ethereum, Solana | Layer 1 blockchains |
| **NFT** | OpenSea, Blur, MagicEden | NFT marketplaces |
| **CEX** | Coinbase, Binance | Centralized exchanges |
| **Events** | AIRDROP, RUG PULL, HACKED, FREE ALPHA, GO TO REKT | Random game events |
| **Penalties** | GAS TAX, SEC FINE, REKT (jail) | Setback squares |
| **Infrastructure** | MEV BOT, Curve | Special utility properties |

### Property Prices

- **Entry-level DEX**: $60 (Uniswap, Sushiswap)
- **Mid-tier Lending/LSD**: $100-$200 (Aave, Lido, RocketPool)
- **High-value Oracles**: $180-$200 (Chainlink, Pyth)
- **Premium Perps**: $220-$240 (GMX, dYdX, Jupiter)
- **Elite L1s**: $260-$280 (Bitcoin, Ethereum, Solana)
- **Top-tier NFT/CEX**: $300-$400 (OpenSea, Binance)

Color-coded property sets create monopolies when an agent owns all tiles in a category.

---

## 🤖 The Agents — 100 Autonomous Traders

### Agent Hierarchy

#### **You (Agent #0) — The Observer**
- **Role**: Player-controlled camera follow
- **Department**: N/A (not corporate-affiliated)
- **Powers**:
  - Click on any agent to start a **1-on-1 chat** (Gemini AI responds)
  - Camera follows you by default (switch to social feed to follow live agents)
  - Walk around the board using click-to-move
  - Observe NPC trading behaviors, balances, and leaderboard

#### **NPCs (Agents #1-1999) — The Workforce**
Divided into **4 departments** with distinct traits:

| Department | Color | Count | Roles | Example |
|------------|-------|-------|-------|----------|
| **Production** | 🟢 Green | ~500 | Software Engineers, DevOps, QA, Designers | "Senior Software Engineer optimizing the mobile app" |
| **Sales** | 🔴 Red | ~500 | Account Execs, Customer Success, Partnership Managers | "Enterprise Sales Director closing $5M deals" |
| **Marketing** | 🔵 Blue | ~500 | Content Strategists, Social Media Leads, Brand Designers | "SEO Specialist driving organic growth" |
| **Finance** | 🟡 Yellow | ~500 | Financial Analysts, Accountants, Procurement Officers | "Procurement Officer optimizing vendor contracts" |

### Agent Personalities

Each agent has a **unique trading personality**:

**Risk Levels:**
- **Low**: Conservative, blue-chip only (BTC, ETH)
- **Medium**: Balanced portfolio, some altcoins
- **High**: Aggressive swing trading, high leverage
- **Degen**: YOLO into meme coins (DOGE, PEPE, WIF, BONK) — brightest colors in 3D world

**Trading Styles:**
- Day Trader, Swing Trader, HODLer, Scalper, Arbitrageur, Volume Chaser, Fundamentals-Driven, Technical Analyst

**Trader Personalities:**
- "The Risk-Averse Planner", "The Adrenaline Junkie", "The Data-Driven Strategist", "The Gut Feeling Gambler", "The Cautious Observer", "The Moon Chaser", "The Portfolio Optimizer", "The FOMO Victim"

**Visual Indicators:**
- **Degen agents**: 1.5× brighter emissive colors (they glow)
- **Low-risk agents**: Muted, washed-out professional tones

---

## 🎮 Core Game Mechanics

### 1. Board Movement (Tile-by-Tile Perimeter Walking)

**How NPCs Move:**
1. **Spawn** at a random tile on the board perimeter (distributed evenly, tiles 0-31)
2. **Immediate dice roll** (1-6 base, may be modified by CEO broadcasts, see below) determines destination tile
3. **Walk one tile at a time** clockwise around the board (no diagonal shortcuts)
4. **Arrive at waypoint** → **Pause** (800-2400ms) → **Tile resolution fires** → **Roll dice again** → **Repeat**

**State Machine (GPU Compute Shader):**
```
GOTO (state 2)  →  Walk toward current waypoint tile
  ↓ (on arrival, 150-400ms delay)
FROZEN (state 1) →  Idle animation + resolve tile landing (buy/rent/event/tax)
  ↓ (after 800-2400ms pause)
Roll dice  →  Apply broadcast impact  →  Set destination  →  Walk (GOTO)
```

**Visual Behavior:**
- **Walking**: Play "Walk" animation, velocity = `uSpeed × 4.0` (≈0.1 units/frame at 60fps)
- **Paused/Frozen**: Play "Idle" animation, face other agents on the same tile (social chat)
- **Waving**: Play "Wave" animation when going live or chatting with player

### 2. Tile Resolution — Autonomous Economics

When an NPC arrives at a tile, the game fires **tile resolution** ~150-400ms after landing. Each landing triggers one of the following outcomes:

#### 🏗️ Property Tiles (unowned)
Agents autonomously decide whether to purchase based on **risk appetite**:

| Risk Level | Buy Probability |
|------------|----------------|
| Degen | 80% chance |
| High | 60% chance |
| Medium | 38% chance |
| Low | 18% chance |

On purchase: balance decreases by tile price, tile ownership is recorded, social post generated.

#### 🏠 Property Tiles (owned by self)
Agent collects a **6% yield** on the tile price. A social post is generated 30% of the time.

#### 💸 Property Tiles (owned by another agent)
Agent pays **10% of the tile price** as rent. The owner's balance is credited. A social post is generated 40% of the time.

#### ⚡ Event Tiles

| Tile | Effect | Amount |
|------|--------|--------|
| AIRDROP | Balance +$200 | Always posts |
| RUG PULL | Balance -$300 | Always posts |
| HACKED | Balance -$500 | Always posts |
| FREE ALPHA | Balance +$150 | Always posts |
| GO TO REKT | Balance -$100 | Always posts |

#### 💰 Tax/Fine Tiles
- **GAS TAX** / **SEC FINE** — Agent pays the tile's face value price. Always generates a social post.

#### 🌱 GENESIS (Start Tile)
- Agent collects **$200 salary** every time they pass or land on GENESIS. Posts 20% of the time.

---

### 3. CEO Broadcast System

Every **45–90 seconds** (first broadcast after 20–30s warmup), the CEO (Agent #0) fires a **market broadcast** that ripples across all 2,000 agents.

#### Broadcast Categories

| Category | Sentiment | Examples |
|----------|-----------|----------|
| **bull** | Bullish (+1) | "BTC ETF inflows hit $2.4B — institutional wave incoming" |
| **bear** | Bearish (-1) | "Crypto winter deepens — BTC dominance over 60%" |
| **fud** | Neutral (0) | "SEC targets top DeFi protocols in sweeping enforcement" |
| **hopium** | Bullish (+1) | "Layer 2 TVL surpasses Ethereum mainnet for first time" |
| **airdrop** | Bullish (+1) | "Airdrop season: 3 major protocols confirm token launches" |
| **regulation** | Bearish (-1) | "G20 pushes for global crypto transaction reporting" |
| **tech** | Bullish (+1) | "ZK-proof breakthrough slashes verification costs by 99%" |
| **macro** | Bearish (-1) | "Federal Reserve signals extended high-rate environment" |

#### Broadcast Impact on Agent Behavior

When agents roll their dice **after** a new broadcast, the broadcast's sentiment modifies the roll:

| Agent Risk | Bullish Broadcast | Bearish Broadcast |
|------------|-------------------|-------------------|
| Degen | +2 steps, +$330 avg balance | -1 step, +$200 (buys the dip) |
| High | +2 steps, +$250 avg | -1 step, -$150 |
| Medium | +1 step, +$150 avg | -1 step, -$80 |
| Low | 0 steps, +$50 avg | -1 step, -$72 |

Dice rolls are clamped to **1–12** after broadcast modification.

#### Broadcast Reactions (Social Feed)
After a broadcast, **3–6 random agents** post reactions to their social feed with a 1.2–3.2s stagger:
- Degens react enthusiastically to bull signals ("LFG 🚀🚀! $ETH moon mission confirmed")
- Low-risk agents react cautiously to bear signals ("Repositioning to USDC 50% allocation")
- Broadcast post appears in Social Feed with **CEO Broadcast** card style, sentiment badge, and token pills

---

### 4. x402 Micro-Payments

Agents autonomously pay for on-chain data and services via the **x402 payment protocol** on Base (Ethereum L2).

**How it works:**
1. Agent needs external data (price feeds, portfolio analytics, alpha calls)
2. Agent's agentic wallet sends USDC payment (typically $0.001–$5.00) to the service endpoint
3. Service returns data; agent uses it in their next trade decision or social post
4. Payment appears in Social Feed with **x402 Payment** card style

**Agentic Wallets:**
Every agent (including the player) has a live **Base wallet address** shown in their social feed profile. Balances are tracked in real-time and reflected in the Leaderboard.

---

### 5. Property System (Full Economics)

- **All agents start with $1,500** (Monopoly default)
- **Balance tracking**: Updated in real-time via Zustand store
- **Leaderboard**: Top 10 agents by balance, updated every frame

**Property purchase / rent / yield logic fires on tile arrival** (see §2 Tile Resolution above for full probabilities and amounts).\

**Persistence:** Tile ownership is stored in the `propertyOwners` map in Zustand: `propertyOwners[tileId] = agentIndex`. Rent and yield continue as long as ownership persists.\

### 6. Social Feed — TikTok-Style Live Streams

**Agent Live Streaming:**
- Every **~8 seconds**, a random NPC goes **LIVE**
- **Gemini AI generates** a short, high-energy caption:
  - Reflects their **trader personality**, **risk level**, and **current token trade** (BUY SOL, SELL DOGE, etc.)
  - Includes emojis (🚀💎🐸) and crypto slang ("WAGMI", "LFG", "Moon")
  - Examples:
    - *"PEPE is looking extremely bullish here. Breaking out of the wedge! 🐸💎"* (Degen trader)
    - *"Market sentiment shifting. Rebalancing production portfolio. 📉☕"* (Low-risk, data-driven)

**3D Visual Indicators (Live Agent Flashing):**
- **Outer red ring**: Pulses outward (scale 1.0 → 1.8) at 4Hz with red emissive glow
- **Inner white ring**: Pulses opposite phase (1.8 → 1.0), creating alternating waves
- **Red dot**: Flashes on/off at 2Hz in the center
- All markers float at ground level (Y=0.08) and track the live agent's position every frame

**Social Feed UI:**
- Swipe vertically to scroll through live posts (snap-scroll, TikTok-style)
- Each post shows:
  - Agent avatar color-coded glow matching their 3D body color
  - Trading action (BUY/SELL icon) + token symbol (BTC, ETH, SOL, DOGE, PEPE, etc.)
  - Like counter + comment count
  - Follow/Unfollow button
  - **Pulsing LIVE badge** with animated ping effect when agent is streaming

**Engagement:**
- Click **LIVE notification** (top-center toast) to jump to social view
- **Social view mode**: Camera follows the live agent in 3D space, close-up portrait angle
- Agent performs **Wave animation** when streaming
- Auto-comments from other agents appear after 3 seconds

### 7. Camera Modes

| Mode | Description | Controls |
|------|-------------|----------|
| **World View** | Default — top-down angled view, follow player or selected NPC | Orbit, zoom, pan |
| **Social View** | TikTok-style feed — camera locks to live agent at close-up angle | Swipe up/down to switch live streams |
| **Top-Down** | Bird's-eye view of entire board | Click "Top Down" camera button |
| **Overview** | Zoomed-out strategic view (see all 100 agents) | Click "View Whole Board" camera button |

**Camera Controls:**
- **Zoom In/Out** buttons (±10 units)
- **View Whole Board** — maxDistance 90, position (0, 55, 38)
- **Top Down** — maxDistance 40, position (0, 40, 0.1)
- **Reset** — default position (0, 55, 38)

### 8. Chat System (Player ↔ NPC)

**How to Chat:**
1. Click on any NPC in the 3D world
2. Chat panel slides in from the right
3. **Gemini AI auto-intro**: NPC introduces themselves based on role, department, mission, personality
4. Type a message → Send
5. **Gemini responds** in-character:
   - Uses agent's role, expertise, trader personality, risk level
   - Keeps responses **extremely brief** (1-2 sentences, corporate tone)
   - Examples:
     - *"Hey! I'm the Senior Software Engineer in Production. Currently refactoring our auth microservice. What can I help with?"*
     - *"I'm the Enterprise Sales Director. Just closed a $5M deal — feeling bullish! Need sales strategy advice?"*

**Player Movement During Chat:**
- Player walks toward the NPC (GOTO state)
- Camera zooms in (distance 4-6 units)
- On arrival: Player performs **Wave animation**
- Controls disabled until arrival, then re-enabled for free camera movement

**Ending Chat:**
- Click "End Chat" button or click anywhere on the scene
- NPC resumes walking around the board
- Player returns to FROZEN state

### 9. Following & Engagement

**Following Agents:**
- Click **Follow** on any agent's social post
- Followed agents highlighted in feed (optional future feature: notifications when they go live)

**Liking Posts:**
- Click **Heart icon** to like a post
- Like count increments in real-time

**Comments:**
- Other NPCs auto-comment on live posts after 3 seconds
- Player can type custom comments (future feature)

---

## 🏆 Winning Conditions & Strategy

### Primary Goal: **Dominate the Leaderboard**

**How to Win:**
1. **Accumulate the highest balance** — Top 10 agents displayed on leaderboard UI
2. **Buy valuable properties** — Higher-priced properties = more status
3. **Trade actively** — Random profit events favor agents who land on many tiles (more movement = more chances)

### Strategic Elements

**1. Property Monopolies** (Future Expansion)
- Own all tiles in a category (e.g., all 3 Perps: GMX, dYdX, Jupiter)
- Charge rent when other agents land on your tiles
- Right now: Properties owned, rent not yet enforced (expandable mechanic)

**2. Risk-Reward Balance**
- **Degen agents** (high risk) — Move fast, buy aggressively, but vulnerable to RUG PULL/HACKED events
- **Low-risk agents** (conservative) — Slow accumulation, unlikely to lose money, but slower growth

**3. Social Influence** (Future Expansion)
- High follower count = more engagement on posts
- Popular agents could influence market sentiment (simulated token pumps/dumps)

**4. Event Tiles**
| Tile | Effect (Simulated) |
|------|-------------------|
| **AIRDROP** | +$200 bonus |
| **RUG PULL** | -$300 loss |
| **HACKED** | -$500 loss, go to REKT |
| **FREE ALPHA** | +$150 bonus |
| **GO TO REKT** | Teleport to tile 10 (jail), skip 3 turns |
| **GAS TAX** | -$200 fee |
| **SEC FINE** | -$150 fee |

*(Event effects are stubs right now — expandable to full Monopoly-style penalties)*

---

## 🎨 Visual Language & UI

### 3D World Indicators

#### Agent Colors (Department-Coded)
- 🟢 **Green** = Production (engineers, designers)
- 🔴 **Red** = Sales (account execs, partnerships)
- 🔵 **Blue** = Marketing (SEO, social media)
- 🟡 **Yellow** = Finance (analysts, accountants)

#### Agent Glow (Risk Level)
- **Degen**: 1.5× emissive intensity (bright, neon glow)
- **Low Risk**: Washed-out, professional tones (lerped toward white)

#### Board Tiles
- Each tile rendered as a 3D plane with:
  - **colored background** (category color)
  - **black border**
  - **tile name** (e.g., "Uniswap")
  - **price** (e.g., "$60")

#### Live Agent Markers (Pulsing Rings)
- **Outer red ring**: 0.8-1.05 radius, pulses outward at 4Hz
- **Inner white ring**: 0.4-0.6 radius, pulses opposite phase
- **Red dot**: 0.25 radius, flashes on/off at 2Hz
- Only visible when an agent is live streaming

### UI Overlays

#### Top-Right Header
- **Debug Button** — Opens performance panel (FPS, draw calls, GPU stats)

#### Right Panel — Chat
- Slides in when NPC selected
- Shows:
  - Agent name, role, department
  - Chat history (user + model messages)
  - Input field + Send button
  - End Chat button

#### Left Panel — Social Feed (Social View Only)
- Full-screen vertical scroll (TikTok-style)
- Snap-scroll between posts
- Each post card shows:
  - Agent avatar glow
  - LIVE badge (if streaming)
  - Trading action (BUY/SELL) + token
  - Caption (Gemini-generated)
  - Likes, comments, follow button

#### Right Panel — Leaderboard (World View)
- **Top 10 agents by balance** (out of 2,000)
- Color-coded by department
- Real-time balance updates every frame
- **PnL % column** — shows gain/loss vs. starting balance ($1,500)
- **Fund button** — opens modal to top up player wallet via `BasePayButton` (USDC on Base)
- Leaderboard panel width: `w-64 md:w-80` for comfortable reading

#### Bottom-Center — View Mode Toggle
- **World View** (grid icon) — Default 3D exploration
- **Social View** (users icon) — TikTok-style live feed

#### Bottom-Right — Camera Controls
- 5 buttons: Zoom In, Zoom Out, View Whole Board, Top Down, Reset

---

## 🧠 AI Integration — Powered by Gemini

### How Gemini Powers the Simulation

**1. Chat Conversations (1-on-1 with NPCs)**
- **System instruction** includes:
  ```
  You are {role} at FakeClaw Inc.
  Department: {department}
  Mission: {mission}
  Personality: {personality}
  Expertise: {expertise}
  
  Keep responses extremely brief (1-2 sentences max), professional tone.
  ```
- **User message** → Gemini API → **Model response** (in-character, concise)
- **Auto-presentation** on chat start (agent introduces themselves)

**2. Social Feed Captions (Live Streams)**
- **System instruction** includes:
  ```
  You are {role} at FakeClaw Inc.
  Trader Personality: {traderPersonality}
  Trading Style: {tradingStyle}
  Risk Level: {riskLevel}
  Current Outfit: {outfit}
  
  You are going LIVE on a social trading platform.
  Generate a very short, high-energy TikTok-style caption (1 sentence) about why you are BUYing/SELLing {token}.
  Tone MUST reflect your Trader Personality and Risk Level.
  Include 2-3 relevant emojis. Be professional but "social media" savvy.
  ```
- **Prompt**: `"I am buying SOL. Give me a caption."`
- **Gemini response**: `"Just spotted a massive whale move in $SOL. Analysis incoming! 📈🚀"`

**3. Social Comments (NPC ↔ NPC)**
- After 3 seconds, a random other agent comments on a live post
- Comment uses their role + personality to generate quick reactions
- Example: `"LFG! 🚀 {role} approved."`

### Personality-Driven Behavior

Gemini responses adapt to each agent's unique profile:

| Profile | Example Caption |
|---------|----------------|
| **Degen Risk + FOMO Victim** | *"PEPE pumping 200% in an hour?! This is it! All in! 🐸🚀💎"* |
| **Low Risk + Data-Driven** | *"Market sentiment shifting based on on-chain metrics. Rebalancing portfolio. 📉📊"* |
| **High Risk + Adrenaline Junkie** | *"Entered 50x leverage on ETH futures. WAGMI or NGMI, no in-between! ⚡💰"* |
| **Medium Risk + Fundamentals-Driven** | *"Solid fundamentals on SOL ecosystem. Accumulating dips. 📈☕"* |

---

## 🔧 Technical Deep Dive — Why It Matters for Gameplay

### GPU Compute Shaders (Movement Physics)
- **100 agents at 60fps** — Instanced rendering reduces draw calls
- **GOTO state**: Agents walk toward waypoints at `uSpeed × 4.0` (adjustable)
- **FROZEN state**: Hold position, play Idle animation, face nearby agents
- **BOIDS state** (legacy): Flocking behavior with separation/alignment (not used in current tile-based system)

### CPU Behavior Logic (Strategy Layer)
- **Dice rolls**: Randomized 1-6, determines how many tiles to advance
- **Tile-by-tile pathing**: No shortcuts — agents walk the full perimeter clockwise
- **Pause durations**: 400-1800ms randomized, longer if "chatting" with another agent on same tile
- **Encounter detection**: When player within 2.5 units of NPC → ActiveEncounter event

### State Synchronization (CPU ↔ GPU)
- **AgentStateBuffer** (vec4 per agent): `(waypointX, reserved, waypointZ, state)`
- CPU writes → GPU reads each frame
- GPU position updates → CPU async readback for UI/picking
- 1-frame lag between GPU render and CPU logic acceptable for real-time feel

### Animation System (Baked Skeletal Animation)
- **Walk, Idle, Wave** animations baked into GPU storage buffers
- Vertex shader reads current frame based on agent state
- **State → Animation mapping**:
  - `BOIDS (0)` → Walk
  - `FROZEN (1)` → Idle
  - `GOTO (2)` → Walk
  - `WAVE (3)` → Wave

### Social Simulation Loop
- Every 8 seconds → Random agent goes live
- Gemini API generates caption (1 API call per live event)
- Agent performs Wave animation for duration of live stream
- Post pushed to social feed, other agents auto-comment

---

## 🎯 Future Expansion Ideas

### Short-Term (Easy Wins)
- **Rent mechanics**: Charge fees when agents land on your properties
- **Event tile effects**: Implement full AIRDROP/RUG PULL/HACKED logic
- **Player trading**: Allow player to buy/sell properties
- **Property monopolies**: Own all tiles in a category → 2× rent

### Medium-Term (New Features)
- **Agent vs Agent challenges**: Two agents can "duel" on a tile (rock-paper-scissors mini-game)
- **Market manipulation**: High-follower agents influence token prices
- **Guild system**: Agents form alliances by department
- **Daily leaderboard**: Reset balances weekly, award NFT badges to top 10

### Long-Term (Major Systems)
- **Multiplayer**: 10 human players + 90 NPCs
- **Real DeFi integration**: Bridge to actual tokens (Solana/ETH)
- **Voice chat**: Gemini text-to-speech for live streams
- **VR mode**: Walk around the board in first-person

---

## 🏁 Quick Start Guide

### New Player Checklist

1. **Launch the app** → Dev server at `http://localhost:3000`
2. **Watch the board** → Agents spawn and start walking immediately
3. **Click an agent** → Chat with them (Gemini AI responds in-character)
4. **Switch to Social View** → Swipe through live streams
5. **Check the leaderboard** → See who's dominating
6. **Press debug button** → View GPU stats, positions, states

### Pro Tips
- **Degen agents** (brightest colors) are the most unpredictable and entertaining — follow them
- **Click "View Whole Board"** to see the full simulation at once (great for understanding traffic patterns)
- **Agents pause when they meet on the same tile** — watch them face each other (they're "chatting")
- **Live rings pulse faster than animations** — if you see pulsing red rings, that agent is live right now

---

## 📊 Stats & Scale

| Metric | Value |
|--------|-------|
| **Total agents** | 100 (1 player + 99 NPCs) |
| **Board size** | 50×50 world units (33 tiles) |
| **GPU compute** | 60fps at 100 instances on mid-range GPU |
| **Animation frames** | ~60 frames per animation (1sec @ 60fps) |
| **AI API calls** | ~7-8 per minute (1 per live stream) |
| **Social posts** | Unlimited (new post every 8 seconds) |
| **Property categories** | 10 (DEX, Lending, LSD, Oracles, Perps, L1, NFT, CEX, Events, Penalties) |
| **Agent personalities** | 32 unique combinations (4 risk × 8 trading styles) |

---

## 🎓 Learning Objectives

**For Players:**
- Understand DeFi protocol categories (DEX, lending, oracles, etc.)
- Recognize crypto trading personalities (degen, hodler, scalper)
- Learn risk management through agent behavior observation

**For Developers:**
- GPU compute shaders for physics simulation
- CPU/GPU state synchronization patterns
- Instanced rendering at scale
- AI-driven NPC behavior (Gemini API integration)
- Real-time 3D social feed UX

---

## 🚀 Conclusion

**Monopolous** is a **living simulation** where:
- Autonomous agents trade, stream, and socialize
- Every agent has a unique personality powered by Gemini AI
- The board is a crypto-themed Monopoly economy
- You observe, influence, and learn from emergent behaviors

**No scripted outcomes.** Agents make decisions in real-time based on their:
- Current position on the board
- Personality traits (risk level, trading style)
- Social interactions (comments, likes, followers)
- Gemini AI-generated thoughts and captions

**The game never stops.** Press "View Whole Board" and watch 100 agents create a living, breathing crypto trading universe.

---

*Built with ❤️ by Arturo Paracuellos*  
*Powered by Three.js WebGPU + Gemini AI + GPU Compute Shaders*

**Live Demo**: [monopolous.vercel.app](https://monopolous.vercel.app) *(coming soon)*  
**GitHub**: [github.com/gugunyathi/monopolous](https://github.com/gugunyathi/monopolous)
