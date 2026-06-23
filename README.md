# Monopolous: Institutional Bot Strategy Framework

A multi-agent economic simulation with institutional-grade trading strategies, autonomous bot orchestration via Gemini ADK, and on-chain execution via Arc testnet.

## Features

### Core Simulation
- **2,000 agents** (1 player + 1,999 NPCs) with department-based roles and personalities
- **10 ARC testnet agents** running on Arc chain (USDC gas-free execution)
- GPU-accelerated Three.js WebGPU rendering with 100-character viewport
- Real-time Zustand state management for wallets, trades, and social feeds

### Autonomous Decision-Making
- **ADK Orchestration**: Gemini-powered autonomous agents using structured function-calling
- **Strategy-aware prompts**: Each bot gets personalized system instructions based on selected trading strategy
- **Multi-tool ecosystem**: Trade, stake, send USDC, place prediction bets (Polymarket), deploy/swap tokens (BankrBot), search x402 services

### 10 Institutional Trading Strategies
1. **Goldman Quantitative Architect** - Short-horizon momentum under vol compression
2. **Renaissance Backtesting Engine** - Out-of-sample validated alpha only
3. **Two Sigma Risk Framework** - VaR-constrained alpha harvesting (default)
4. **Citadel Alpha Research** - Orthogonal micro-signal blending
5. **Jane Street Market Making** - Spread capture with inventory control
6. **AQR Factor Builder** - Value/momentum/quality/size/low-vol premia
7. **D.E. Shaw Statistical Arbitrage** - Cointegrated pair mean reversion
8. **Bridgewater Macro** - Regime rotation across growth/inflation quadrants
9. **Bloomberg Data Pipeline** - Trade only on validated, high-integrity feeds
10. **Virtu Execution Algorithms** - TWAP/VWAP adaptive slicing

**Each strategy includes:**
- Thesis statement and signal model
- Entry/exit rules and position sizing logic
- Risk controls and decay monitoring
- Allowed tools whitelist (enforced in ADK prompts)
- Max trade size percentage

### ARC Policy & Autonomy System
- **Per-agent policy persistence** with MongoDB
- **Strategy selection + parameter overrides** per ARC agent
- **Autonomous tick scheduler** that respects daily USDC caps and cooldowns
- **Confirmation polling** for on-chain tx status + manual intervention queue
- **Admin UI** (PolicyEditor) for live policy tweaking

### On-Chain Integration
- **Arc testnet USDC transfers** via Circle CCTP Bridge
- **Strategy-modulated execution** (multipliers per strategy)
- **Real wallet provisioning** (env-based overrides for agent addresses)
- **Circuit breaker halt logic** on RPC failures or policy violations

## Tech Stack

**Frontend:**
- Vite + React + TypeScript
- Three.js (WebGPU for instanced rendering)
- Zustand (state management)
- @google/genai (Gemini ADK integration)

**Backend:**
- Node.js + Express
- MongoDB (policies, executions, webhooks)
- Stripe/Circle integration (USDC on-chain)
- Vercel Functions (serverless /api/index)

## Getting Started

### Prerequisites
```bash
Node.js 24.x
npm or yarn
Python 3.10+ (for research backtesting)
```

### Local Development

1. **Clone and install:**
```bash
git clone https://github.com/gugunyathi/monopolous.git
cd monopolous
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
# Add:
# VITE_GEMINI_API_KEY=your_key
# VITE_ARC_RPC_KEY=your_arc_rpc_key
# MONGODB_URI=your_mongodb_uri
# DATABASE_URL=your_database_url
```

3. **Start dev server:**
```bash
npm run dev
```

4. **Open http://localhost:3000**

### Production Deployment

- **Frontend**: Deployed on Vercel at [monopolous.vercel.app](https://monopolous.vercel.app)
- **Backend API**: Hosted as Vercel Functions at `/api/index`
- **Trigger autonomy tick**: Via admin UI or `vercel invoke arc/autonomy/tick`

## Scripts

- `npm run dev` - Start dev server (frontend + backend in parallel via Vite proxy)
- `npm run build` - Build frontend + backend for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `python research/quant_backtesting_engine.py` - Run strategy backtesting framework

## Project Structure

```
.
├── src/                              # Frontend (React + Three.js)
│   ├── constants/tradingStrategies.ts  # 10-strategy catalog
│   ├── services/
│   │   ├── adk/
│   │   │   ├── orchestrator.ts       # Gemini ADK + strategy prompting
│   │   │   └── tools.ts              # Wallet, BankrBot, Polymarket tools
│   │   ├── apiService.ts             # Backend API client
│   │   └── arcWalletService.ts       # ARC testnet wallet mgmt
│   ├── components/
│   │   ├── PolicyEditor.tsx          # Inline ARC policy UI
│   │   ├── ArcAgentsPanel.tsx        # ARC agents + executions dashboard
│   │   └── ...
│   ├── three/                        # WebGPU rendering & behavior
│   └── store/useStore.ts             # Zustand state
│
├── server/src/                       # Backend (Express + MongoDB)
│   ├── constants/strategyCatalog.ts  # Strategy registry + multipliers
│   ├── models/
│   │   ├── ArcPolicy.ts              # Policy schema with strategyId
│   │   ├── ArcExecution.ts           # On-chain tx log
│   │   └── ...
│   ├── services/
│   │   ├── arcAutonomyService.ts     # Scheduler + tick executor
│   │   ├── arcExecutor.ts            # Circle CCTP integration
│   │   └── ...
│   ├── routes/
│   │   ├── arc.ts                    # /api/arc/* endpoints
│   │   └── ...
│   └── index.ts
│
├── docs/
│   └── INSTITUTIONAL_STRATEGY_BLUEPRINT.md  # Full strategy specifications
│
├── research/
│   └── quant_backtesting_engine.py   # Walk-forward, VaR, IC, Monte Carlo
│
└── vercel.json                       # Vercel config
```

## Strategy Assignment & Behavior

### Frontend (ADK Decision Loop)
1. Agent fetches its assigned `strategyId` from global agent data
2. ADK orchestrator retrieves strategy spec (thesis, signal model, allowed tools, max trade %)
3. Strategy spec is injected into system prompt to guide decision-making
4. Tool whitelist is applied—only allowed tools appear in function-calling options
5. Trade sizing respects strategy's `maxTradePct` in prompt instructions

### Backend (ARC Autonomy)
1. Admin selects `selectedStrategyId` + optional `strategyOverrides` in PolicyEditor
2. Policy is persisted to MongoDB with strategy metadata
3. Autonomy tick executor fetches policy, multiplies transfer amount by strategy multiplier
4. Executes on-chain via Circle CCTP Bridge with ARC testnet RPC

## API Endpoints

### ARC Admin Endpoints (require auth)
- `GET /api/arc/status` - Overall ARC system status
- `GET /api/arc/policies` - List all agent policies
- `GET /api/arc/strategies` - Fetch strategy catalog + execution multipliers
- `PATCH /api/arc/policies/:agentIndex` - Update agent strategy + overrides
- `POST /api/arc/autonomy/tick` - Trigger manual autonomy tick
- `POST /api/arc/autonomy/start` - Start scheduler
- `POST /api/arc/autonomy/stop` - Stop scheduler

### Social/Trading Endpoints
- `GET /api/social/feed` - Live agent posts + bets
- `GET /api/trades` - Trade history with strategy tags
- `POST /api/social/post` - Create agent post
- `POST /api/tokens/launch` - Deploy new token (BankrBot)

## Research & Backtesting

### Quant Framework
Located in `research/quant_backtesting_engine.py`:
- Event-driven backtest simulator with transaction costs
- Walk-forward validation (train/test/validate splits)
- Value at Risk (historical + parametric)
- Monte Carlo trade bootstrap (10k paths)
- Information Coefficient & significance tests
- Equity curve + drawdown charting

**Run:**
```bash
pip install numpy pandas matplotlib scipy
python research/quant_backtesting_engine.py
```

## Configuration

### Environment Variables
```bash
# Frontend
VITE_GEMINI_API_KEY          # Google Gemini API key for ADK
VITE_ARC_RPC_KEY             # Arc testnet RPC endpoint + key
VITE_BNKR_MASTER_ADDRESS     # BankrBot master wallet (optional)

# Backend
MONGODB_URI                  # MongoDB connection string
DATABASE_URL                 # Postgres (if using Prisma)
ARC_AUTONOMY_ENABLED         # true/false
ARC_AUTONOMY_INTERVAL_MS     # Tick interval (default 60000)
CORS_ORIGIN                  # CORS whitelist (comma-separated)
PORT                         # Server port (default 3001)
```

### Policy Configuration
Edit policies via admin UI or MongoDB directly:
```javascript
{
  agentIndex: 2000,
  enabled: true,
  selectedStrategyId: "two_sigma_risk",
  strategyOverrides: { urgency: 0.65, regimeConfidence: 0.7 },
  maxUsdcPerTx: 500,
  maxUsdcPerDay: 5000,
  cooldownSeconds: 300,
  allowlistedToAddresses: ["0x..."],
  allowlistedTokenAddresses: []  // empty = allow all tokens
}
```

## Development Workflow

1. **Assign strategy to bot** → Edit agent profile in `src/data/agents.ts`, set `strategyId`
2. **Test in ADK** → Agent's next decision loop uses that strategy's prompt + tools
3. **Deploy on Arc** → Select same strategy in ARC PolicyEditor, autonomy will use multiplier
4. **Monitor execution** → Watch ArcAgentsPanel for live executions + confirmations
5. **Backtest offline** → Use `quant_backtesting_engine.py` to validate strategy before live

## Deployment

### Vercel Production
```bash
vercel link --project monopolous --scope 2satoshy-gmailcoms-projects
vercel --prod --yes
```

Alias: [monopolous.vercel.app](https://monopolous.vercel.app)

## Project Structure

## License & IP

License & Intellectual Property
This project follows a dual-licensing model to distinguish between the functional source code and the creative artistic assets:

Source Code (MIT)
All source code files (.js, .jsx, .css) are licensed under the MIT License.
You are free to use, copy, modify, and distribute the code for both personal and commercial projects. See the LICENSE file for full details.

3D Models & Assets (CC BY-NC 4.0)
All 3D models (.glb, .gltf), textures, and custom environment maps located in the /public/models directory are Copyright © 2026 Arturo Paracuellos (unboring.net) and are licensed under Creative Commons Attribution-NonCommercial 4.0 International.

Attribution: You must give appropriate credit to Arturo Paracuellos (unboring.net).

Adaptation: You are free to remix, transform, and build upon these assets.

Non-Commercial: You may not use these assets or their derivatives for commercial purposes.

To view a copy of this license, visit: CC BY-NC 4.0

Developed with ❤️ by Arturo Paracuellos
