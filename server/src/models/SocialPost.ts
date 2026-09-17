import { Schema, model, Document } from 'mongoose';

export interface ISocialPost extends Document {
  id: string;
  agentIndex: number;
  sessionId: string;
  type: 'post' | 'live' | 'x402' | 'broadcast' | 'tile';
  content: string;
  token?: string;
  action?: string;
  likes: number;
  timestamp: number;
  postCategory?: string;
  isADK: boolean;
  polymarket?: Record<string, unknown>;
}

const SocialPostSchema = new Schema<ISocialPost>({
  id: { type: String, required: true, unique: true },
  agentIndex: { type: Number, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['post', 'live', 'x402', 'broadcast', 'tile'],
    default: 'post',
  },
  content: { type: String, required: true, maxlength: 2000 },
  token: { type: String, default: null },
  action: { type: String, default: null },
  likes: { type: Number, default: 0 },
  timestamp: { type: Number, index: true },
  postCategory: { type: String, default: null },
  isADK: { type: Boolean, default: false },
  polymarket: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

SocialPostSchema.index({ agentIndex: 1, timestamp: -1 });
SocialPostSchema.index({ sessionId: 1, timestamp: -1 });

export const SocialPost = model<ISocialPost>('SocialPost', SocialPostSchema);
