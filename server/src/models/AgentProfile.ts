import { Schema, model, Document } from 'mongoose';

export interface IAgentProfile extends Document {
  agentIndex: number;
  name: string;
  role: string;
  walletAddress?: string;
  bnkrWalletId?: string;
  bnkrMasterAddress?: string;
  avatarUrl?: string;
  personality?: string;
  strategy?: string;
  bio?: string;
  traits?: string[];
  skills?: string[];
  status?: string;
  isADKActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentProfileSchema = new Schema<IAgentProfile>({
  agentIndex: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  walletAddress: { type: String, lowercase: true, default: null, index: true },
  bnkrWalletId: { type: String, default: null },
  bnkrMasterAddress: { type: String, lowercase: true, default: null },
  avatarUrl: { type: String, default: null },
  personality: { type: String, default: '' },
  strategy: { type: String, default: '' },
  bio: { type: String, default: '' },
  traits: [{ type: String }],
  skills: [{ type: String }],
  status: { type: String, default: 'active' },
  isADKActive: { type: Boolean, default: true },
}, { timestamps: true });

export const AgentProfile = model<IAgentProfile>('AgentProfile', AgentProfileSchema);
