import { Schema, model, Document } from 'mongoose';

export interface IAgentSession extends Document {
  sessionId: string;
  agentIndex: number;
  walletAddress?: string;
  userAddress?: string;
  status: 'active' | 'completed' | 'terminated';
  startedAt: Date;
  endedAt?: Date;
  totalActionsCount: number;
  totalTradesCount: number;
  totalVolumeUSDC: number;
  initialBalance: number;
  finalBalance?: number;
  netWorthChange?: number;
  metadata?: Record<string, unknown>;
}

const AgentSessionSchema = new Schema<IAgentSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  agentIndex: { type: Number, required: true, index: true },
  walletAddress: { type: String, lowercase: true, default: null, index: true },
  userAddress: { type: String, lowercase: true, default: null },
  status: { type: String, enum: ['active', 'completed', 'terminated'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  totalActionsCount: { type: Number, default: 0 },
  totalTradesCount: { type: Number, default: 0 },
  totalVolumeUSDC: { type: Number, default: 0 },
  initialBalance: { type: Number, default: 1500 },
  finalBalance: { type: Number, default: null },
  netWorthChange: { type: Number, default: 0 },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

AgentSessionSchema.index({ agentIndex: 1, startedAt: -1 });

export const AgentSession = model<IAgentSession>('AgentSession', AgentSessionSchema);
