/**
 * Webhook Service
 *
 * Manages webhook delivery for ARC events (confirmations, failures, transfers).
 * Includes retries with backoff and HMAC signing for security.
 */

import crypto from 'node:crypto';
import { WebhookEndpoint, WebhookEvent, type IWebhookEndpoint } from '../models/WebhookEndpoint.js';

const MAX_WEBHOOK_TIMEOUT = 30000; // 30 seconds

export class WebhookService {
  /**
   * Create or update a webhook endpoint
   */
  static async upsertEndpoint(
    name: string,
    url: string,
    events: string[],
    secret?: string
  ): Promise<IWebhookEndpoint> {
    const endpoint = await WebhookEndpoint.findOneAndUpdate(
      { name },
      {
        url,
        events,
        secret: secret || generateSecret(),
        $setOnInsert: {
          enabled: true,
          maxRetries: 5,
          retryDelaySeconds: 60,
          failureCount: 0,
          successCount: 0,
        },
      },
      { upsert: true, new: true }
    );

    if (!endpoint) {
      throw new Error('Failed to create webhook endpoint');
    }

    return endpoint;
  }

  /**
   * List all webhook endpoints
   */
  static async listEndpoints(): Promise<IWebhookEndpoint[]> {
    return WebhookEndpoint.find({}).sort({ createdAt: -1 });
  }

  /**
   * Get a specific webhook endpoint
   */
  static async getEndpoint(id: string): Promise<IWebhookEndpoint | null> {
    return WebhookEndpoint.findById(id);
  }

  /**
   * Update a webhook endpoint
   */
  static async updateEndpoint(
    id: string,
    updates: {
      url?: string;
      enabled?: boolean;
      events?: string[];
      maxRetries?: number;
      retryDelaySeconds?: number;
    }
  ): Promise<IWebhookEndpoint | null> {
    return WebhookEndpoint.findByIdAndUpdate(id, updates, { new: true });
  }

  /**
   * Delete a webhook endpoint
   */
  static async deleteEndpoint(id: string): Promise<boolean> {
    const result = await WebhookEndpoint.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * Trigger a webhook event for a specific event type
   */
  static async triggerEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await WebhookEndpoint.find({
      enabled: true,
      events: eventType,
    });

    if (endpoints.length === 0) {
      return;
    }

    const event: WebhookEvent = {
      type: eventType as 'arc.confirmation' | 'arc.failure' | 'arc.transfer',
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const promises = endpoints.map((endpoint) => {
      return this.deliverWebhook(endpoint, event).catch((error) => {
        console.error(
          `[WebhookService] Failed to deliver webhook to ${endpoint.name}:`,
          error instanceof Error ? error.message : error
        );
      });
    });

    await Promise.all(promises);
  }

  /**
   * Deliver a webhook event to an endpoint with retries
   */
  private static async deliverWebhook(
    endpoint: IWebhookEndpoint,
    event: WebhookEvent,
    attempt = 1
  ): Promise<void> {
    try {
      const signature = this.generateSignature(event, endpoint.secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.type,
        'X-Webhook-Timestamp': event.timestamp,
        'X-Webhook-Attempt': String(attempt),
      };

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        timeout: MAX_WEBHOOK_TIMEOUT,
      });

      if (response.ok) {
        // Success
        await WebhookEndpoint.updateOne(
          { _id: endpoint._id },
          {
            $inc: { successCount: 1 },
            $set: { lastTriggeredAt: new Date() },
          }
        );
        return;
      }

      if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Server error or timeout - retry
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const isLastAttempt = attempt >= endpoint.maxRetries;

      if (isLastAttempt) {
        // Give up
        await WebhookEndpoint.updateOne(
          { _id: endpoint._id },
          {
            $inc: { failureCount: 1 },
            $set: { lastTriggeredAt: new Date() },
          }
        );
        throw new Error(
          `Webhook delivery failed after ${attempt} attempts to ${endpoint.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Retry with backoff
      const backoffMs = endpoint.retryDelaySeconds * 1000 * Math.pow(2, attempt - 1);
      console.log(
        `[WebhookService] Retrying webhook ${endpoint.name} in ${Math.round(backoffMs / 1000)}s (attempt ${attempt}/${endpoint.maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return this.deliverWebhook(endpoint, event, attempt + 1);
    }
  }

  /**
   * Generate HMAC-SHA256 signature for webhook
   */
  private static generateSignature(event: WebhookEvent, secret: string): string {
    const payload = JSON.stringify(event);
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature (for receiving webhooks)
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

/**
 * Generate a random secret for webhook signing
 */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
