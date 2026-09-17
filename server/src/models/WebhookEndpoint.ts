import { Document, Schema, model } from 'mongoose';

export interface IWebhookEndpoint extends Document {
  name: string;
  url: string;
  secret: string; // HMAC secret for signature verification
  events: Array<'arc.confirmation' | 'arc.failure' | 'arc.transfer'>;
  enabled: boolean;
  maxRetries: number;
  retryDelaySeconds: number;
  lastTriggeredAt?: Date;
  failureCount: number;
  successCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEndpointSchema = new Schema<IWebhookEndpoint>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    secret: { type: String, required: true, select: false }, // Don't select by default
    events: {
      type: [String],
      enum: ['arc.confirmation', 'arc.failure', 'arc.transfer'],
      default: ['arc.confirmation'],
    },
    enabled: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 5 },
    retryDelaySeconds: { type: Number, default: 60 },
    lastTriggeredAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WebhookEndpointSchema.index({ enabled: 1 });
WebhookEndpointSchema.index({ createdAt: -1 });

export const WebhookEndpoint = model<IWebhookEndpoint>('WebhookEndpoint', WebhookEndpointSchema);

/**
 * Webhook events that can be triggered
 */
export interface WebhookEvent {
  type: 'arc.confirmation' | 'arc.failure' | 'arc.transfer';
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryRecord {
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastError?: string;
  status: 'pending' | 'delivered' | 'failed';
}
