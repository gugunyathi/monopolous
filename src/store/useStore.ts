
import { create } from 'zustand';
import { CharacterState, AnimationName, PerformanceStats, BoidsParams, ActiveEncounter, Broadcast, SocialPost } from '../types';
import { AGENTS, CORE_AGENT_COUNT } from '../data/agents';

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
    instanceCount: 100,
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

    // Monopoly Game State
    boardTiles: [
      { id: '0', name: 'GENESIS', type: 'start' },
      { id: '1', name: 'Uniswap', type: 'property', price: 60, color: '#ff007a', category: 'DEX' },
      { id: '2', name: 'AIRDROP', type: 'event' },
      { id: '3', name: 'Sushiswap', type: 'property', price: 60, color: '#ff007a', category: 'DEX' },
      { id: '4', name: 'GAS TAX', type: 'tax', price: 200 },
      { id: '5', name: 'Curve', type: 'property', price: 200, color: '#00d1ff', category: 'Stable' },
      { id: '6', name: 'Aave', type: 'property', price: 100, color: '#b6509e', category: 'Lending' },
      { id: '7', name: 'RUG PULL', type: 'event' },
      { id: '8', name: 'Compound', type: 'property', price: 100, color: '#b6509e', category: 'Lending' },
      { id: '9', name: 'MakerDAO', type: 'property', price: 120, color: '#b6509e', category: 'Lending' },
      { id: '10', name: 'REKT', type: 'jail' },
      { id: '11', name: 'Lido', type: 'property', price: 140, color: '#ff8c00', category: 'LSD' },
      { id: '12', name: 'RocketPool', type: 'property', price: 140, color: '#ff8c00', category: 'LSD' },
      { id: '13', name: 'Frax', type: 'property', price: 160, color: '#ff8c00', category: 'LSD' },
      { id: '14', name: 'MEV BOT', type: 'property', price: 200, color: '#00d1ff', category: 'Infra' },
      { id: '15', name: 'Chainlink', type: 'property', price: 180, color: '#2a5ada', category: 'Oracle' },
      { id: '16', name: 'Pyth', type: 'property', price: 180, color: '#2a5ada', category: 'Oracle' },
      { id: '17', name: 'HACKED', type: 'event' },
      { id: '18', name: 'The Graph', type: 'property', price: 200, color: '#2a5ada', category: 'Oracle' },
      { id: '19', name: 'FREE ALPHA', type: 'event' },
      { id: '20', name: 'GMX', type: 'property', price: 220, color: '#ef4444', category: 'Perps' },
      { id: '21', name: 'dYdX', type: 'property', price: 220, color: '#ef4444', category: 'Perps' },
      { id: '22', name: 'Jupiter', type: 'property', price: 240, color: '#ef4444', category: 'Perps' },
      { id: '23', name: 'Solana', type: 'property', price: 260, color: '#00ffa3', category: 'L1' },
      { id: '24', name: 'Ethereum', type: 'property', price: 260, color: '#00ffa3', category: 'L1' },
      { id: '25', name: 'Bitcoin', type: 'property', price: 280, color: '#00ffa3', category: 'L1' },
      { id: '26', name: 'SEC FINE', type: 'tax', price: 150 },
      { id: '27', name: 'OpenSea', type: 'property', price: 300, color: '#2081e2', category: 'NFT' },
      { id: '28', name: 'Blur', type: 'property', price: 300, color: '#2081e2', category: 'NFT' },
      { id: '29', name: 'MagicEden', type: 'property', price: 320, color: '#2081e2', category: 'NFT' },
      { id: '30', name: 'GO TO REKT', type: 'event' },
      { id: '31', name: 'Coinbase', type: 'property', price: 350, color: '#0052ff', category: 'CEX' },
      { id: '32', name: 'Binance', type: 'property', price: 400, color: '#0052ff', category: 'CEX' },
    ],
    agentBalances: buildInitialBalances(),
    leaderboard: [],

    performance: {
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      entities: 0
    },

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
    addPost: (post) => set((state) => ({ socialFeed: [post, ...state.socialFeed].slice(0, 200) })),
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
        return {
          agentBalances: { ...state.agentBalances, [agentIndex]: balance - price },
          boardTiles: state.boardTiles.map(t => t.id === tileId ? { ...t, ownerIndex: agentIndex } : t)
        };
      }
      return state;
    }),
    updateBalance: (agentIndex, amount) => set((state) => ({
      agentBalances: { ...state.agentBalances, [agentIndex]: (state.agentBalances[agentIndex] || 1500) + amount }
    })),
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
