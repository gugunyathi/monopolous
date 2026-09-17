import { Schema, model, Document } from 'mongoose';

export interface ITokenLaunch extends Document {
  sessionId: string;
  deployerAgentIndex: number;
  deployerAddress?: string;     // On-chain deployer address

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

  // Fee tracking
  feeRecipientAddress?: string;
  totalFeesClaimed: number;
  lastFeeClaimAt?: Date;

  // Pool metrics (updated periodically)
  currentPrice?: number;
  totalVolume?: number;
  totalHolders?: number;

  deployedAt: Date;
}

const TokenLaunchSchema = new Schema<ITokenLaunch>({
  sessionId: { type: String, required: true, index: true },
  deployerAgentIndex: { type: Number, required: true, index: true },
  deployerAddress: { type: String, lowercase: true, default: null },

  tokenName: { type: String, required: true },
  tokenSymbol: { type: String, required: true, uppercase: true },
  tokenAddress: { type: String, required: true, unique: true, lowercase: true },
  poolId: { type: String, required: true },
  txHash: { type: String, default: null },
  activityId: { type: String, default: null },
  chain: { type: String, default: 'base' },
  simulated: { type: Boolean, default: false },

  description: { type: String, default: null },
  imageUrl: { type: String, default: null },

  feeRecipientAddress: { type: String, lowercase: true, default: null },
  totalFeesClaimed: { type: Number, default: 0 },
  lastFeeClaimAt: { type: Date, default: null },

  currentPrice: { type: Number, default: null },
  totalVolume: { type: Number, default: null },
  totalHolders: { type: Number, default: null },

  deployedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

TokenLaunchSchema.index({ deployerAgentIndex: 1, deployedAt: -1 });
TokenLaunchSchema.index({ tokenSymbol: 1 });

export const TokenLaunch = model<ITokenLaunch>('TokenLaunch', TokenLaunchSchema);
