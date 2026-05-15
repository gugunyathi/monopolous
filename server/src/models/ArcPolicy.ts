import { Document, Schema, model } from 'mongoose';

export interface IArcPolicy extends Document {
  agentIndex: number;
  enabled: boolean;
  allowlistedToAddresses: string[];
  allowlistedTokenAddresses: string[];
  maxUsdcPerTx: number;
  maxUsdcPerDay: number;
  cooldownSeconds: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArcPolicySchema = new Schema<IArcPolicy>(
  {
    agentIndex: { type: Number, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    allowlistedToAddresses: {
      type: [String],
      default: [],
      set: (items: string[]) => (items ?? []).map((x) => x.toLowerCase()),
    },
    allowlistedTokenAddresses: {
      type: [String],
      default: [],
      set: (items: string[]) => (items ?? []).map((x) => x.toLowerCase()),
    },
    maxUsdcPerTx: { type: Number, required: true, default: 25 },
    maxUsdcPerDay: { type: Number, required: true, default: 100 },
    cooldownSeconds: { type: Number, required: true, default: 90 },
    lastExecutedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ArcPolicySchema.index({ enabled: 1, agentIndex: 1 });

export const ArcPolicy = model<IArcPolicy>('ArcPolicy', ArcPolicySchema);
