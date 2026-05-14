import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  address: string;          // Ethereum wallet address (lowercase, primary key)
  ens?: string;             // ENS name if resolved
  bnkrWalletAddress?: string;
  displayName?: string;
  avatarUrl?: string;

  // Stats
  totalGamesPlayed: number;
  totalTradesExecuted: number;
  totalTokensLaunched: number;
  allTimeBestBalance: number;
  allTimeWorstBalance: number;

  // Timestamps
  firstLoginAt: Date;
  lastActiveAt: Date;
  lastSessionId?: string;

  // Farcaster / social
  farcasterFid?: number;
  farcasterUsername?: string;
}

const UserSchema = new Schema<IUser>({
  address: { type: String, required: true, unique: true, lowercase: true, index: true },
  ens: { type: String, default: null },
  bnkrWalletAddress: { type: String, default: null },
  displayName: { type: String, default: null },
  avatarUrl: { type: String, default: null },

  totalGamesPlayed: { type: Number, default: 0 },
  totalTradesExecuted: { type: Number, default: 0 },
  totalTokensLaunched: { type: Number, default: 0 },
  allTimeBestBalance: { type: Number, default: 1500 },
  allTimeWorstBalance: { type: Number, default: 1500 },

  firstLoginAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  lastSessionId: { type: String, default: null },

  farcasterFid: { type: Number, default: null },
  farcasterUsername: { type: String, default: null },
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);
