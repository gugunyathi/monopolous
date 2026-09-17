import { Schema, model, Document } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IAgentChat extends Document {
  agentIndex: number;
  walletAddress?: string;
  userAddress?: string;
  sessionId: string;
  messages: IChatMessage[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  role: { type: String, enum: ['user', 'agent'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { _id: false });

const AgentChatSchema = new Schema<IAgentChat>({
  agentIndex: { type: Number, required: true, index: true },
  walletAddress: { type: String, lowercase: true, default: null, index: true },
  userAddress: { type: String, lowercase: true, default: null, index: true },
  sessionId: { type: String, required: true, index: true },
  messages: [ChatMessageSchema],
  lastMessageAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

AgentChatSchema.index({ agentIndex: 1, sessionId: 1 }, { unique: true });

export const AgentChat = model<IAgentChat>('AgentChat', AgentChatSchema);
