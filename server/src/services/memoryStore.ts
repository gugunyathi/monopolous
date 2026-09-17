// In-memory persistent state store for offline fallback mode

export interface InMemoryUser {
  address: string;
  ens?: string;
  displayName?: string;
  avatarUrl?: string;
  totalGamesPlayed: number;
  totalTradesExecuted: number;
  totalTokensLaunched: number;
  allTimeBestBalance: number;
  allTimeWorstBalance: number;
  firstLoginAt: Date;
  lastActiveAt: Date;
  lastSessionId?: string;
  farcasterFid?: number;
  farcasterUsername?: string;
}

export interface InMemoryNonce {
  address: string;
  nonce: string;
  createdAt: Date;
}

export interface InMemoryAgentState {
  agentIndex: number;
  sessionId?: string;
  currentBalance: number;
  peakBalance: number;
  propertiesOwned: number[];
  currentTileIndex: number;
  isInJail: boolean;
  jailTurnsRemaining?: number;
  totalTradesCount: number;
  totalTokensLaunched: number;
  totalPolymarketBets?: number;
  totalX402Payments?: number;
  totalRentCollected?: number;
  totalRentPaid?: number;
  totalSpent?: number;
  isADKActive: boolean;
  adkActionsCount?: number;
  currentRank: number;
  currentNetWorth: number;
  bnkrWalletId?: string;
  bnkrMasterAddress?: string;
  allocatedBalance?: number;
  lastActiveAt: Date;
}

export interface InMemoryTrade {
  _id: string;
  sessionId: string;
  agentIndex: number;
  tradeType: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  pnl?: number;
  txHash?: string;
  bankrJobId?: string;
  chain: string;
  simulated: boolean;
  triggerReason: string;
  traderPersonality?: string;
  timestamp: Date;
}

export interface InMemoryTokenLaunch {
  _id: string;
  sessionId: string;
  deployerAgentIndex: number;
  deployerAddress?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  poolId: string;
  txHash?: string;
  activityId?: string;
  chain: string;
  simulated: boolean;
  description?: string;
  imageUrl?: string;
  feeRecipientAddress?: string;
  totalFeesClaimed: number;
  lastFeeClaimAt?: Date;
  deployedAt: Date;
}

export interface InMemoryGameSession {
  sessionId: string;
  userAddress: string;
  startBalance: number;
  endBalance?: number;
  peakBalance: number;
  lowestBalance: number;
  propertiesOwned: any[];
  totalPropertyValue: number;
  tradesCount: number;
  tokensLaunched: number;
  polymarketBets: number;
  broadcastsSent: number;
  x402PaymentsMade: number;
  finalRank?: number;
  finalNetWorth?: number;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface InMemorySocialPost {
  id: string;
  agentIndex: number;
  sessionId: string;
  type: string;
  content: string;
  token?: string;
  action?: string;
  likes: number;
  timestamp: number;
  postCategory?: string;
  isADK?: boolean;
  polymarket?: Record<string, unknown>;
}

class MemoryStore {
  public nonces = new Map<string, InMemoryNonce>();
  public users = new Map<string, InMemoryUser>();
  public agentStates = new Map<number, InMemoryAgentState>();
  public trades: InMemoryTrade[] = [];
  public tokens: InMemoryTokenLaunch[] = [];
  public sessions = new Map<string, InMemoryGameSession>();
  public socialPosts: InMemorySocialPost[] = [];

  constructor() {
    // Seed initial agent states for 20 agents
    for (let i = 0; i < 20; i++) {
      this.agentStates.set(i, {
        agentIndex: i,
        currentBalance: 1500,
        peakBalance: 1500,
        propertiesOwned: [],
        currentTileIndex: 0,
        isInJail: false,
        totalTradesCount: 0,
        totalTokensLaunched: 0,
        isADKActive: true,
        currentRank: i + 1,
        currentNetWorth: 1500,
        lastActiveAt: new Date(),
      });
    }
  }

  public getOrCreateUser(address: string): InMemoryUser {
    const key = address.toLowerCase();
    let user = this.users.get(key);
    if (!user) {
      user = {
        address: key,
        displayName: `${key.slice(0, 6)}...${key.slice(-4)}`,
        totalGamesPlayed: 0,
        totalTradesExecuted: 0,
        totalTokensLaunched: 0,
        allTimeBestBalance: 1500,
        allTimeWorstBalance: 1500,
        firstLoginAt: new Date(),
        lastActiveAt: new Date(),
      };
      this.users.set(key, user);
    }
    return user;
  }
}

export const memoryStore = new MemoryStore();
