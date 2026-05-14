import { Schema, model, Document } from 'mongoose';

export type TradeType = 'swap' | 'buy' | 'sell' | 'x402' | 'dca' | 'limit_order';

export interface ITrade extends Document {
  sessionId: string;
  agentIndex: number;
  tradeType: TradeType;

  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount?: number;

  // Balance snapshot
  balanceBefore: number;
  balanceAfter: number;
  pnl?: number;                // profit/loss from this trade

  // On-chain data (if real BankrBot tx)
  txHash?: string;
  bankrJobId?: string;
  chain: string;
  simulated: boolean;

  // Context
  triggerReason?: string;      // "tile_landing" | "autonomous" | "adk" | "player_command"
  traderPersonality?: string;

  timestamp: Date;
}

const TradeSchema = new Schema<ITrade>({
  sessionId: { type: String, required: true, index: true },
  agentIndex: { type: Number, required: true, index: true },
  tradeType: {
    type: String,
    enum: ['swap', 'buy', 'sell', 'x402', 'dca', 'limit_order'],
    default: 'swap',
  },

  fromToken: { type: String, required: true },
  toToken: { type: String, required: true },
  fromAmount: { type: Number, required: true },
  toAmount: { type: Number, default: null },

  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  pnl: { type: Number, default: null },

  txHash: { type: String, default: null },
  bankrJobId: { type: String, default: null },
  chain: { type: String, default: 'base' },
  simulated: { type: Boolean, default: true },

  triggerReason: { type: String, default: 'autonomous' },
  traderPersonality: { type: String, default: null },

  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Indexes for common queries
TradeSchema.index({ agentIndex: 1, timestamp: -1 });
TradeSchema.index({ sessionId: 1, agentIndex: 1 });
TradeSchema.index({ txHash: 1 }, { sparse: true });

export const Trade = model<ITrade>('Trade', TradeSchema);
