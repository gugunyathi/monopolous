import { Schema, model, Document } from 'mongoose';

/**
 * AgentState persists the current game-state for each core agent (0-99).
 * Upserted on every meaningful state change. One document per agent.
 */
export interface IAgentState extends Document {
  agentIndex: number;           // 0 = player, 1-99 = core NPCs
  sessionId: string;

  // Wallet / financial
  currentBalance: number;
  startingBalance: number;
  peakBalance: number;
  totalEarned: number;
  totalSpent: number;

  // BNKR wallet (for agents 0-99)
  bnkrWalletId?: string;
  bnkrMasterAddress?: string;
  allocatedBalance: number;

  // Game state
  propertiesOwned: string[];    // Array of tileIds
  currentTileIndex: number;     // Current position on the Monopoly board (0-32)
  isInJail: boolean;
  jailTurnsRemaining: number;

  // Activity stats
  totalTradesCount: number;
  totalTokensLaunched: number;
  totalPolymarketBets: number;
  totalX402Payments: number;
  totalRentCollected: number;
  totalRentPaid: number;

  // ADK / autonomous mode
  isADKActive: boolean;
  lastADKActionAt?: Date;
  adkActionsCount: number;

  // Leaderboard
  currentRank: number;
  currentNetWorth: number;

  lastActiveAt: Date;
}

const AgentStateSchema = new Schema<IAgentState>({
  agentIndex: { type: Number, required: true, unique: true, index: true },
  sessionId: { type: String, required: true },

  currentBalance: { type: Number, default: 1500 },
  startingBalance: { type: Number, default: 1500 },
  peakBalance: { type: Number, default: 1500 },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  bnkrWalletId: { type: String, default: null },
  bnkrMasterAddress: { type: String, lowercase: true, default: null },
  allocatedBalance: { type: Number, default: 0 },

  propertiesOwned: [{ type: String }],
  currentTileIndex: { type: Number, default: 0 },
  isInJail: { type: Boolean, default: false },
  jailTurnsRemaining: { type: Number, default: 0 },

  totalTradesCount: { type: Number, default: 0 },
  totalTokensLaunched: { type: Number, default: 0 },
  totalPolymarketBets: { type: Number, default: 0 },
  totalX402Payments: { type: Number, default: 0 },
  totalRentCollected: { type: Number, default: 0 },
  totalRentPaid: { type: Number, default: 0 },

  isADKActive: { type: Boolean, default: false },
  lastADKActionAt: { type: Date, default: null },
  adkActionsCount: { type: Number, default: 0 },

  currentRank: { type: Number, default: 0 },
  currentNetWorth: { type: Number, default: 1500 },

  lastActiveAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const AgentState = model<IAgentState>('AgentState', AgentStateSchema);
