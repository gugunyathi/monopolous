/**
 * ConfirmationQueue
 *
 * Manages retry/backoff queue for pending ARC transaction confirmations
 * when the RPC becomes temporarily unavailable. Uses exponential backoff
 * with jitter to avoid thundering herd.
 */

interface QueuedConfirmation {
  executionId: string;
  txHash: string;
  agentIndex: number;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
}

const DEFAULT_INITIAL_BACKOFF_MS = 5000; // 5 seconds
const DEFAULT_MAX_BACKOFF_MS = 300000; // 5 minutes
const DEFAULT_MAX_RETRIES = 50; // ~1 hour of retries
const JITTER_FACTOR = 0.2;

export class ConfirmationQueue {
  private queue: Map<string, QueuedConfirmation> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processingCallback: (
    executionIds: string[]
  ) => Promise<void>;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private maxRetries: number;

  constructor(
    processingCallback: (executionIds: string[]) => Promise<void>,
    options?: {
      initialBackoffMs?: number;
      maxBackoffMs?: number;
      maxRetries?: number;
    }
  ) {
    this.processingCallback = processingCallback;
    this.initialBackoffMs = options?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = options?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Add an execution to the retry queue
   */
  enqueue(executionId: string, txHash: string, agentIndex: number): void {
    if (this.queue.has(executionId)) {
      return;
    }

    this.queue.set(executionId, {
      executionId,
      txHash,
      agentIndex,
      retryCount: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    });

    this.scheduleProcessing(executionId);
  }

  /**
   * Remove an execution from the queue (e.g., when confirmed or failed)
   */
  dequeue(executionId: string): void {
    this.queue.delete(executionId);
    const timer = this.timers.get(executionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(executionId);
    }
  }

  /**
   * Get pending items in queue
   */
  getPending(): QueuedConfirmation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Clear all pending confirmations (useful for cleanup)
   */
  clear(): void {
    this.queue.clear();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private scheduleProcessing(executionId: string): void {
    const item = this.queue.get(executionId);
    if (!item) return;

    // Cancel existing timer
    const existingTimer = this.timers.get(executionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Check if we've exceeded max retries
    if (item.retryCount >= this.maxRetries) {
      console.warn(
        `[ConfirmationQueue] Execution ${executionId} exceeded max retries (${this.maxRetries}). Removing from queue.`
      );
      this.dequeue(executionId);
      return;
    }

    // Calculate backoff: exponential with jitter
    const backoffMs = this.calculateBackoff(item.retryCount);
    const jitterMs = backoffMs * JITTER_FACTOR * (Math.random() * 2 - 1);
    const delayMs = Math.max(0, backoffMs + jitterMs);
    const nextRetryAt = Date.now() + delayMs;

    item.nextRetryAt = nextRetryAt;

    const timer = setTimeout(async () => {
      this.timers.delete(executionId);
      item.retryCount++;

      try {
        await this.processingCallback([executionId]);
      } catch (error) {
        // Reschedule on error
        console.error(
          `[ConfirmationQueue] Error processing ${executionId}:`,
          error instanceof Error ? error.message : error
        );
        this.scheduleProcessing(executionId);
      }
    }, delayMs);

    this.timers.set(executionId, timer);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: min(initialBackoff * 2^retries, maxBackoff)
    const backoff = this.initialBackoffMs * Math.pow(2, retryCount);
    return Math.min(backoff, this.maxBackoffMs);
  }

  /**
   * Get queue stats for monitoring
   */
  getStats() {
    const items = Array.from(this.queue.values());
    const now = Date.now();

    return {
      totalPending: items.length,
      readyNow: items.filter((i) => i.nextRetryAt <= now).length,
      averageRetries: items.length > 0 ? items.reduce((s, i) => s + i.retryCount, 0) / items.length : 0,
      oldestItem: items.length > 0 ? Math.max(...items.map((i) => now - i.createdAt)) : 0,
    };
  }
}
