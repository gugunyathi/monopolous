import { Schema, model, Document } from 'mongoose';

/**
 * Auth nonces for wallet sign-in challenge-response.
 * TTL index auto-deletes expired nonces after 10 minutes.
 */
export interface INonce extends Document {
  address: string;    // lowercase wallet address
  nonce: string;      // random challenge string
  createdAt: Date;    // used for TTL
}

const NonceSchema = new Schema<INonce>({
  address: { type: String, required: true, lowercase: true, index: true },
  nonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // auto-delete after 10 min
});

export const Nonce = model<INonce>('Nonce', NonceSchema);
