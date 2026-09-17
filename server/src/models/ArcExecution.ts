import { Document, Schema, model } from 'mongoose';

export type ArcActionType = 'transfer';
export type ArcExecutionStatus = 'queued' | 'estimated' | 'submitted' | 'confirmed' | 'failed';

export interface IArcExecution extends Document {
  agentIndex: number;
  actionType: ArcActionType;
  chain: string;
  walletAddress: string;
  toAddress: string;
  tokenAddress?: string;
  amount: string;
  idempotencyKey: string;
  reason?: string;
  requestedBy: string;
  status: ArcExecutionStatus;
  estimateOnly: boolean;
  txHash?: string;
  transactionId?: string;
  blockNumber?: number;
  confirmations?: number;
  confirmedAt?: Date;
  confirmationPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  rawOutput?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArcExecutionSchema = new Schema<IArcExecution>(
  {
    agentIndex: { type: Number, required: true, index: true },
    actionType: { type: String, enum: ['transfer'], required: true },
    chain: { type: String, default: 'ARC-TESTNET' },
    walletAddress: { type: String, required: true, lowercase: true },
    toAddress: { type: String, required: true, lowercase: true },
    tokenAddress: { type: String, default: null, lowercase: true },
    amount: { type: String, required: true },
    idempotencyKey: { type: String, required: true, index: true },
    reason: { type: String, default: null },
    requestedBy: { type: String, required: true, lowercase: true, index: true },
    status: { type: String, enum: ['queued', 'estimated', 'submitted', 'confirmed', 'failed'], required: true, index: true },
    estimateOnly: { type: Boolean, default: false },
    txHash: { type: String, default: null, index: true },
    transactionId: { type: String, default: null, index: true },
    blockNumber: { type: Number, default: null },
    confirmations: { type: Number, default: null },
    confirmedAt: { type: Date, default: null },
    confirmationPayload: { type: Schema.Types.Mixed, default: null },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    rawOutput: { type: String, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

ArcExecutionSchema.index({ agentIndex: 1, createdAt: -1 });
ArcExecutionSchema.index({ chain: 1, status: 1, createdAt: -1 });

export const ArcExecution = model<IArcExecution>('ArcExecution', ArcExecutionSchema);
