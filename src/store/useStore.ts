
import { create } from 'zustand';
import { CharacterState, AnimationName, PerformanceStats, BoidsParams, ActiveEncounter, Broadcast, SocialPost, PolymarketMarket, PolymarketActiveBet } from '../types';
import { AGENTS, ARC_AGENTS, CORE_AGENT_COUNT } from '../data/agents';
import { MONOPOLY_VEHICLES } from '../data/vehicles';
import {
  recordTrade,
  recordTokenLaunch,
  recordPropertyPurchase,
  persistPost,
  updateAgentState,
  getSessionId,
  startSession,
  updateSession,
} from '../services/apiService';

// Initialize balances for all 100 core agents from their wallet data
function buildInitialBalances(): Record<number, number> {
  const balances: Record<number, number> = {};
  for (let i = 0; i < CORE_AGENT_COUNT; i++) {
    const agent = AGENTS[i];
    if (agent) balances[i] = agent.wallet.balance;
  }
  return balances;
}

export const useStore = create<CharacterState>()(
  (set) => ({
    currentAction: AnimationName.WALK,
    isThinking: false,
    aiResponse: "Hello! I'm your AI character. Type something to talk to me.",
    isDebugOpen: false,
    isHeatmapMode: false,
    toggleHeatmapMode: () => set((state) => ({ isHeatmapMode: !state.isHeatmapMode })),
    mobileOptimizationMode: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    toggleMobileOptimization: () => set((state) => ({ mobileOptimizationMode: !state.mobileOptimizationMode })),
    instanceCount: CORE_AGENT_COUNT + ARC_AGENTS.length,
    worldSize: 25,      // radius of Kaldera

    // Default Boids Parameters
    boidsParams: {
      speed: 0.025,
      separationRadius: 0.6,
      separationStrength: 0.030,
      alignmentRadius: 3.0,
      cohesionRadius: 3.0
    },

    debugPositions: null,
    debugStates: null,
    activeEncounter: null,
    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoverPosition: null,
    isChatting: false,
    chatMessages: [],

    // Social & Trading
    viewMode: 'about',
    socialFeed: [
      {
        id: 'init-1',
        agentIndex: 1,
        type: 'live',
        isLive: true,
        content: 'Just spotted a massive whale move in $SOL. Analysis incoming! 📈🚀',
        token: 'SOL',
        action: 'buy',
        likes: 42,
        comments: [
          { id: 'c1', agentIndex: 5, text: 'Following this closely!', timestamp: Date.now() }
        ],
        timestamp: Date.now()
      },
      {
        id: 'init-2',
        agentIndex: 12,
        type: 'post',
        content: 'Market sentiment is shifting. Rebalancing the production portfolio. 📉☕',
        token: 'BTC',
        action: 'sell',
        likes: 12,
        comments: [],
        timestamp: Date.now() - 100000
      },
      {
        id: 'init-3',
        agentIndex: 25,
        type: 'live',
        isLive: true,
        content: 'PEPE is looking extremely bullish here. Breaking out of the wedge! 🐸💎',
        token: 'PEPE',
        action: 'buy',
        likes: 88,
        comments: [],
        timestamp: Date.now() - 50000
      },
      {
        id: 'init-4',
        agentIndex: 45,
        type: 'live',
        isLive: true,
        content: 'DOGE to the moon? 🚀 Just added to my long position. Much wow.',
        token: 'DOGE',
        action: 'buy',
        likes: 156,
        comments: [],
        timestamp: Date.now() - 20000
      }
    ],
    activeSocialAgentIndex: null,
    following: new Set(),
    tradingLog: [],

    // ADK agent tracking (agents currently controlled by autonomous orchestrator)
    activeADKAgents: new Set<number>(),

    // Polymarket live data + active bets
    polymarketData: [] as PolymarketMarket[],
    polymarketBets: [] as PolymarketActiveBet[],

    // BankrBot Token Launches
    launchedTokens: [],

    // BNKR Wallet State
    bnkrMasterAddress: '',
    bnkrConnectionStatus: 'disconnected' as const,
    bnkrWallets: [],

    // Auth
    userAddress: null,

    // CEO Broadcast
    activeBroadcast: null,
    broadcastHistory: [],
    addBroadcast: (b: Broadcast) => set((state) => ({
      activeBroadcast: b,
      broadcastHistory: [b, ...state.broadcastHistory].slice(0, 20),
      // CEO broadcasts also post to social feed automatically
      socialFeed: [{
        id: b.id,
        agentIndex: 0,
        type: 'broadcast' as SocialPost['type'],
        content: b.headline,
        token: b.tokens[0] ?? '',
        action: (b.sentiment === 1 ? 'buy' : 'sell') as SocialPost['action'],
        likes: 0,
        comments: [],
        timestamp: b.timestamp,
        broadcast: b,
      } as SocialPost, ...state.socialFeed].slice(0, 50),
    })),

    // Monopoly Game State - Strategic Crypto Exchanges, DEXs & Prediction Markets (32 tiles)
    boardTiles: [
      { id: '0', name: 'GENESIS', type: 'start', volume24h: '$0', volatility: 'Low', volumeScore: 10 },
      { id: '1', name: 'Uniswap', type: 'property', price: 60, color: '#ff007a', category: 'DEX', volume24h: '$1.8B', volatility: 'High', volumeScore: 85 },
      { id: '2', name: 'Aerodrome', type: 'property', price: 80, color: '#0052ff', category: 'DEX', volume24h: '$420M', volatility: 'Medium', volumeScore: 65 },
      { id: '3', name: 'AIRDROP', type: 'event', volume24h: '$50M', volatility: 'Extreme', volumeScore: 90 },
      { id: '4', name: 'Hyperliquid', type: 'property', price: 100, color: '#10b981', category: 'DEX', volume24h: '$3.4B', volatility: 'Extreme', volumeScore: 95 },
      { id: '5', name: 'GAS SPIKE', type: 'tax', price: 100, volume24h: '$12M', volatility: 'High', volumeScore: 70 },
      { id: '6', name: 'Aave', type: 'property', price: 120, color: '#b6509e', category: 'Lending', volume24h: '$890M', volatility: 'Medium', volumeScore: 60 },
      { id: '7', name: 'POLY: BTC $100K?', type: 'prediction', color: '#9333ea', polymarketTopic: 'bitcoin', volume24h: '$120M', volatility: 'High', volumeScore: 88 },
      { id: '8', name: 'REKT', type: 'jail', volume24h: '$0', volatility: 'Extreme', volumeScore: 40 },
      { id: '9', name: 'Coinbase', type: 'property', price: 200, color: '#0052ff', category: 'CEX', volume24h: '$5.2B', volatility: 'Medium', volumeScore: 92 },
      { id: '10', name: 'Binance', type: 'property', price: 220, color: '#f3ba2f', category: 'CEX', volume24h: '$14.6B', volatility: 'High', volumeScore: 99 },
      { id: '11', name: 'Bybit', type: 'property', price: 220, color: '#f7931a', category: 'CEX', volume24h: '$6.8B', volatility: 'Extreme', volumeScore: 94 },
      { id: '12', name: 'Gate.io', type: 'property', price: 240, color: '#23527c', category: 'CEX', volume24h: '$1.5B', volatility: 'Medium', volumeScore: 62 },
      { id: '13', name: 'OKX', type: 'property', price: 240, color: '#1a1a1a', category: 'CEX', volume24h: '$4.1B', volatility: 'High', volumeScore: 82 },
      { id: '14', name: 'Kraken', type: 'property', price: 260, color: '#5741d9', category: 'CEX', volume24h: '$2.3B', volatility: 'Low', volumeScore: 58 },
      { id: '15', name: 'KALSHI: FED RATE?', type: 'prediction', color: '#9333ea', polymarketTopic: 'fed', volume24h: '$85M', volatility: 'Medium', volumeScore: 75 },
      { id: '16', name: 'Curve', type: 'property', price: 180, color: '#00d1ff', category: 'Stable', volume24h: '$340M', volatility: 'Low', volumeScore: 45 },
      { id: '17', name: 'Compound', type: 'property', price: 180, color: '#b6509e', category: 'Lending', volume24h: '$290M', volatility: 'Low', volumeScore: 42 },
      { id: '18', name: 'Lido', type: 'property', price: 200, color: '#ff8c00', category: 'LSD', volume24h: '$750M', volatility: 'Low', volumeScore: 50 },
      { id: '19', name: 'MakerDAO', type: 'property', price: 200, color: '#b6509e', category: 'Lending', volume24h: '$620M', volatility: 'Low', volumeScore: 48 },
      { id: '20', name: 'GMX', type: 'property', price: 220, color: '#ef4444', category: 'Perps', volume24h: '$810M', volatility: 'Extreme', volumeScore: 86 },
      { id: '21', name: 'dYdX', type: 'property', price: 220, color: '#6966ff', category: 'Perps', volume24h: '$1.1B', volatility: 'High', volumeScore: 78 },
      { id: '22', name: 'Jupiter', type: 'property', price: 240, color: '#c792ea', category: 'Perps', volume24h: '$1.4B', volatility: 'Extreme', volumeScore: 89 },
      { id: '23', name: 'PREDICTIT', type: 'prediction', color: '#9333ea', polymarketTopic: 'election', volume24h: '$45M', volatility: 'Medium', volumeScore: 68 },
      { id: '24', name: 'Solana', type: 'property', price: 280, color: '#14f195', category: 'L1', volume24h: '$3.8B', volatility: 'Extreme', volumeScore: 91 },
      { id: '25', name: 'Ethereum', type: 'property', price: 300, color: '#627eea', category: 'L1', volume24h: '$7.5B', volatility: 'High', volumeScore: 96 },
      { id: '26', name: 'Bitcoin', type: 'property', price: 320, color: '#f7931a', category: 'L1', volume24h: '$18.2B', volatility: 'High', volumeScore: 100 },
      { id: '27', name: 'SEC FINE', type: 'tax', price: 200, volume24h: '$5M', volatility: 'Extreme', volumeScore: 55 },
      { id: '28', name: 'OpenSea', type: 'property', price: 350, color: '#2081e2', category: 'NFT', volume24h: '$110M', volatility: 'Medium', volumeScore: 52 },
      { id: '29', name: 'Blur', type: 'property', price: 350, color: '#ff6b00', category: 'NFT', volume24h: '$95M', volatility: 'High', volumeScore: 60 },
      { id: '30', name: 'POLY: ETH ETF?', type: 'prediction', color: '#9333ea', polymarketTopic: 'ethereum', volume24h: '$210M', volatility: 'High', volumeScore: 84 },
      { id: '31', name: 'MagicEden', type: 'property', price: 400, color: '#e42575', category: 'NFT', volume24h: '$140M', volatility: 'Medium', volumeScore: 56 },
    ],
    agentBalances: buildInitialBalances(),
    leaderboard: [],
    agentVehicles: MONOPOLY_VEHICLES,
    isPhysicalCharactersModalOpen: false,
    togglePhysicalCharactersModal: () => set((state) => ({ isPhysicalCharactersModalOpen: !state.isPhysicalCharactersModalOpen })),
    buyVehicle: (vehicleId, agentIndex) => set((state) => {
      const vehicle = state.agentVehicles.find(v => v.id === vehicleId);
      if (!vehicle || vehicle.ownerIndex !== undefined) return state;

      const balance = state.agentBalances[agentIndex] ?? 1500;
      if (balance >= vehicle.price) {
        return {
          agentBalances: { ...state.agentBalances, [agentIndex]: balance - vehicle.price },
          agentVehicles: state.agentVehicles.map(v => v.id === vehicleId ? { ...v, ownerIndex: agentIndex } : v),
        };
      }
      return state;
    }),
    buyTileFloor: (tileIndex, agentIndex) => set((state) => {
      const tile = state.boardTiles[tileIndex];
      if (!tile || tile.type !== 'property') return state;

      const currentFloors = tile.floors || 0;
      const floorCost = 150 * (currentFloors + 1);
      const balance = state.agentBalances[agentIndex] ?? 1500;

      if (balance >= floorCost) {
        const updatedTiles = [...state.boardTiles];
        updatedTiles[tileIndex] = {
          ...tile,
          floors: currentFloors + 1,
          ownerIndex: tile.ownerIndex ?? agentIndex,
        };
        return {
          agentBalances: { ...state.agentBalances, [agentIndex]: balance - floorCost },
          boardTiles: updatedTiles,
        };
      }
      return state;
    }),

    performance: {
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      entities: 0
    },

    weather: 'none',
    setWeather: (weather) => set({ weather }),

    setAnimation: (name: string) => set({ currentAction: name }),
    setThinking: (isThinking: boolean) => set({ isThinking }),
    setAIResponse: (aiResponse: string) => set({ aiResponse }),
    toggleDebug: () => set((state) => ({ isDebugOpen: !state.isDebugOpen })),
    setInstanceCount: (count: number) => set({ instanceCount: count }),
    setWorldSize: (size: number) => set({ worldSize: size }),

    setBoidsParams: (params) => set((state) => ({
      boidsParams: { ...state.boidsParams, ...params }
    })),

    setDebugPositions: (positions) => set({ debugPositions: positions }),
    setDebugStates: (states) => set({ debugStates: states }),
    setActiveEncounter: (encounter: ActiveEncounter | null) => set({ activeEncounter: encounter }),
    setSelectedNpc: (index: number | null) => set({ selectedNpcIndex: index, selectedPosition: null }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({ hoveredNpcIndex: index, hoverPosition: pos }),
    startChat: () => {},
    endChat: () => {},
    sendMessage: async () => {},

    // Social Actions
    setUserAddress: (address) => set({ userAddress: address }),
    setViewMode: (mode) => set({ viewMode: mode }),
    toggleFollow: (index) => set((state) => {
      const next = new Set(state.following);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { following: next };
    }),
    addPost: (post) => {
      const sessionId = getSessionId();
      if (sessionId && (post.isADK || post.type === 'x402' || post.type === 'broadcast' || post.postCategory === 'token-launch')) {
        persistPost({ ...post, sessionId }).catch(() => {/* non-blocking */});
      }
      return set((state) => ({ socialFeed: [post, ...state.socialFeed].slice(0, 200) }));
    },
    addComment: (postId, comment) => set((state) => ({
      socialFeed: state.socialFeed.map(p => p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)
    })),
    likePost: (postId) => set((state) => ({
      socialFeed: state.socialFeed.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p)
    })),
    setActiveSocialAgentIndex: (index) => set({ activeSocialAgentIndex: index }),

    // ADK Agent Tracking
    markAgentAsADK: (agentIndex: number) => set((state) => {
      const next = new Set(state.activeADKAgents);
      next.add(agentIndex);
      return { activeADKAgents: next };
    }),
    unmarkAgentAsADK: (agentIndex: number) => set((state) => {
      const next = new Set(state.activeADKAgents);
      next.delete(agentIndex);
      return { activeADKAgents: next };
    }),

    // Polymarket Actions
    setPolymarketData: (markets: PolymarketMarket[]) => set({ polymarketData: markets }),
    placePredictionBet: (agentIndex, marketId, question, side, amount, price = 0.5) => set((state) => {
      const balance = state.agentBalances[agentIndex] ?? 1500;
      const capped = Math.min(amount, balance * 0.2);
      if (capped < 1) return state;

      const resolvedPrice = Math.min(0.99, Math.max(0.01, price));
      const shares = capped / resolvedPrice;
      const potentialWin = shares;
      const now = Date.now();

      const bet: PolymarketActiveBet = {
        id: `bet-${agentIndex}-${now}`,
        agentIndex,
        marketId,
        question,
        side,
        amount: Math.round(capped * 100) / 100,
        price: resolvedPrice,
        shares: Math.round(shares * 100) / 100,
        potentialWin: Math.round(potentialWin * 100) / 100,
        simulated: true,
        placedAt: now,
      };

      // Deduct balance, add to bets list, post to feed
      const sideEmoji = side === 'YES' ? '🟢' : '🔴';
      const agent = AGENTS[agentIndex];
      const post: SocialPost = {
        id: `poly-tile-${agentIndex}-${now}`,
        agentIndex,
        type: 'post',
        content:
          `${sideEmoji} Landed on POLYMARKET tile! 🎯\n\n` +
          `"${question.slice(0, 70)}"\n` +
          `Bet: ${side} @ ${(resolvedPrice * 100).toFixed(0)}¢ — $${bet.amount.toFixed(2)} USDC\n` +
          `Potential win: $${bet.potentialWin.toFixed(2)}\n\n` +
          `📍 Polygon market — simulated until bridge funded`,
        token: 'USDC',
        action: 'buy',
        likes: Math.floor(Math.random() * 30),
        comments: [],
        timestamp: now,
        postCategory: 'prediction',
        polymarket: {
          marketId,
          question,
          side,
          amount: bet.amount,
          simulated: true,
          price: resolvedPrice,
          shares: bet.shares,
          potentialWin: bet.potentialWin,
        },
      };

      return {
        agentBalances: { ...state.agentBalances, [agentIndex]: balance - bet.amount },
        polymarketBets: [bet, ...state.polymarketBets].slice(0, 200),
        socialFeed: [post, ...state.socialFeed].slice(0, 200),
      };
    }),

    // BankrBot Token Launch Tracking
    addLaunchedToken: (token) => set((state) => ({
      launchedTokens: [token, ...state.launchedTokens].slice(0, 50),
    })),

    // BNKR Wallet Actions
    setBnkrMasterAddress: (address) => set({ bnkrMasterAddress: address }),
    setBnkrConnectionStatus: (status) => set({ bnkrConnectionStatus: status }),
    setBnkrWallets: (wallets) => set({
      bnkrWallets: wallets.map((w) => ({
        agentIndex: w.agentIndex,
        walletId: w.walletId,
        masterAddress: w.masterAddress,
        status: w.status,
        label: w.label,
        allocatedBalance: w.allocatedBalance,
        totalSpent: w.totalSpent,
        totalEarned: w.totalEarned,
        capabilities: w.capabilities,
        createdAt: w.createdAt,
        lastActiveAt: w.lastActiveAt,
      })),
    }),
    updateBnkrWallet: (agentIndex, updates) => set((state) => ({
      bnkrWallets: state.bnkrWallets.map((w) =>
        w.agentIndex === agentIndex ? { ...w, ...updates } : w,
      ),
    })),

    // Game Actions
    buyProperty: (agentIndex, tileId) => set((state) => {
      const tile = state.boardTiles.find(t => t.id === tileId);
      if (!tile || tile.type !== 'property' || tile.ownerIndex !== undefined) return state;
      
      const balance = state.agentBalances[agentIndex] || 1500;
      const price = tile.price || 0;
      
      if (balance >= price) {
        const newBalance = balance - price;
        const sessionId = getSessionId();
        if (sessionId) {
          recordPropertyPurchase({
            agentIndex,
            tileId,
            tileName: tile.name,
            purchasePrice: price,
            sessionId,
            balanceBefore: balance,
            balanceAfter: newBalance,
          }).catch(() => {/* non-blocking */});
        }
        return {
          agentBalances: { ...state.agentBalances, [agentIndex]: newBalance },
          boardTiles: state.boardTiles.map(t => t.id === tileId ? { ...t, ownerIndex: agentIndex } : t),
        };
      }
      return state;
    }),
    updateBalance: (agentIndex, amount) => set((state) => {
      const prev = state.agentBalances[agentIndex] ?? 1500;
      const next = prev + amount;
      const sessionId = getSessionId();
      // Persist agent balance snapshot non-blocking
      if (sessionId) {
        updateAgentState(agentIndex, { currentBalance: next, currentNetWorth: next }).catch(() => {/* non-blocking */});
      }
      return { agentBalances: { ...state.agentBalances, [agentIndex]: next } };
    }),
    updateLeaderboard: () => set((state) => {
      const leaderboard = Object.entries(state.agentBalances).map(([idx, bal]) => {
        const agentIndex = parseInt(idx);
        const propertiesValue = state.boardTiles
          .filter(t => t.ownerIndex === agentIndex)
          .reduce((sum, t) => sum + (t.price || 0), 0);
        return { agentIndex, netWorth: bal + propertiesValue };
      }).sort((a, b) => b.netWorth - a.netWorth).slice(0, 10);
      return { leaderboard };
    }),

    updatePerformance: (performance: PerformanceStats) => set({ performance }),
  })
);
