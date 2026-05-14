import { Schema, model, Document } from 'mongoose';

export interface PropertyRecord {
  tileId: string;
  tileName: string;
  purchasedAt: Date;
  purchasePrice: number;
}

export interface IGameSession extends Document {
  sessionId: string;            // UUID
  userAddress: string;          // Player wallet (null for NPC-only sessions)
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;

  // Player (Agent 0) state at start/end
  startBalance: number;
  endBalance?: number;
  peakBalance: number;
  lowestBalance: number;

  // Properties owned at session end
  propertiesOwned: PropertyRecord[];
  totalPropertyValue: number;

  // Activity counters
  tradesCount: number;
  tokensLaunched: number;
  polymarketBets: number;
  broadcastsSent: number;
  x402PaymentsMade: number;

  // Leaderboard position at session end
  finalRank?: number;
  finalNetWorth?: number;
}

const PropertyRecordSchema = new Schema<PropertyRecord>({
  tileId: String,
  tileName: String,
  purchasedAt: Date,
  purchasePrice: Number,
}, { _id: false });

const GameSessionSchema = new Schema<IGameSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  userAddress: { type: String, lowercase: true, index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true, index: true },

  startBalance: { type: Number, default: 1500 },
  endBalance: { type: Number, default: null },
  peakBalance: { type: Number, default: 1500 },
  lowestBalance: { type: Number, default: 1500 },

  propertiesOwned: [PropertyRecordSchema],
  totalPropertyValue: { type: Number, default: 0 },

  tradesCount: { type: Number, default: 0 },
  tokensLaunched: { type: Number, default: 0 },
  polymarketBets: { type: Number, default: 0 },
  broadcastsSent: { type: Number, default: 0 },
  x402PaymentsMade: { type: Number, default: 0 },

  finalRank: { type: Number, default: null },
  finalNetWorth: { type: Number, default: null },
}, { timestamps: true });

export const GameSession = model<IGameSession>('GameSession', GameSessionSchema);
