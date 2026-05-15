# ARC Panel Enhancements - Implementation Guide

## Overview

This document describes the new features added to the ARC Agents Panel:

1. **Inline Policy Editing** - Edit agent policies directly in the panel
2. **Webhook Support** - Push-based confirmation notifications for transfer providers
3. **Confirmation Queue** - Automatic retry/backoff for pending TX confirmations when RPC is unavailable

---

## 1. Inline Policy Editing

### Components

#### `PolicyEditor` Component ([src/components/PolicyEditor.tsx](src/components/PolicyEditor.tsx))

Modal dialog for editing ARC agent policies inline. Opens when clicking the edit button (✎) on any policy row.

**Features:**
- Enable/disable agents
- Edit USDC per-transaction limit
- Edit USDC per-day limit
- Edit cooldown period (seconds)
- Manage allowlisted destination addresses
- Manage allowlisted token addresses
- Real-time validation
- Intuitive form with textarea for address lists

**Usage:**
```tsx
<PolicyEditor
  policy={policyRecord}
  onSave={async (updates) => {
    await updateArcPolicy(agentIndex, updates);
  }}
  onCancel={() => setEditingPolicy(null)}
  isSaving={false}
/>
```

#### Updated `ArcAgentsPanel` Component

**New Features:**
- Policy table now shows edit button (✎) on hover
- Click any policy row to open editor
- Real-time policy updates reflected in table
- Error notifications on save failure
- Queue stats indicator (⏱) shows pending confirmation count

**State Management:**
```tsx
const [editingPolicy, setEditingPolicy] = useState<ArcPolicyRecord | null>(null);
const [savingPolicy, setSavingPolicy] = useState(false);
const [policyError, setPolicyError] = useState<string | null>(null);
```

### API Updates

#### `updateArcPolicy` Function ([src/services/apiService.ts](src/services/apiService.ts))

New function to send policy updates to the server:

```typescript
export async function updateArcPolicy(
  agentIndex: number,
  updates: {
    enabled?: boolean;
    allowlistedToAddresses?: string[];
    allowlistedTokenAddresses?: string[];
    maxUsdcPerTx?: number;
    maxUsdcPerDay?: number;
    cooldownSeconds?: number;
  }
): Promise<ArcPolicyRecord>
```

**Backend Endpoint:**
```
PATCH /api/arc/policies/:agentIndex
```

---

## 2. Webhook Support

### Models

#### `WebhookEndpoint` Model ([server/src/models/WebhookEndpoint.ts](server/src/models/WebhookEndpoint.ts))

Represents a registered webhook endpoint for event notifications.

**Fields:**
- `name` - Endpoint name (unique)
- `url` - HTTP endpoint URL to receive events
- `secret` - HMAC-SHA256 secret for signature verification
- `events` - Array of event types to subscribe to
- `enabled` - Whether endpoint is active
- `maxRetries` - Number of retry attempts (default: 5)
- `retryDelaySeconds` - Initial delay between retries (default: 60s, exponential backoff)
- `lastTriggeredAt` - Timestamp of last event delivery
- `failureCount` - Total failed deliveries
- `successCount` - Total successful deliveries

**Supported Events:**
- `arc.transfer` - Transfer initiated
- `arc.confirmation` - Transaction confirmed on-chain
- `arc.failure` - Transaction failed/reverted

### Service

#### `WebhookService` ([server/src/services/webhookService.ts](server/src/services/webhookService.ts))

Manages webhook lifecycle and event delivery.

**Key Methods:**
```typescript
// Endpoint management
static async upsertEndpoint(name, url, events, secret?): Promise<IWebhookEndpoint>
static async listEndpoints(): Promise<IWebhookEndpoint[]>
static async getEndpoint(id): Promise<IWebhookEndpoint | null>
static async updateEndpoint(id, updates): Promise<IWebhookEndpoint | null>
static async deleteEndpoint(id): Promise<boolean>

// Event handling
static async triggerEvent(eventType, payload): Promise<void>

// Security
static generateSignature(event, secret): string
static verifySignature(payload, signature, secret): boolean
```

**Features:**
- HMAC-SHA256 signing for security
- Exponential backoff with jitter for retries
- Configurable retry count and delay
- Automatic failure tracking
- Delivered with these headers:
  - `X-Webhook-Signature`: HMAC-SHA256 signature
  - `X-Webhook-Event`: Event type
  - `X-Webhook-Timestamp`: ISO 8601 timestamp
  - `X-Webhook-Attempt`: Attempt number (1-based)

**Event Payload Structure:**
```json
{
  "type": "arc.confirmation",
  "timestamp": "2025-05-15T10:30:00.000Z",
  "data": {
    "executionId": "...",
    "txHash": "0x...",
    "agentIndex": 2000,
    "confirmations": 12,
    "blockNumber": 12345
  }
}
```

### API Routes

#### Webhook Management Endpoints ([server/src/routes/arc.ts](server/src/routes/arc.ts))

```typescript
// List all webhooks
GET /api/arc/webhooks
Response: { success: true, endpoints: IWebhookEndpoint[] }

// Create or update webhook
POST /api/arc/webhooks
Body: { name, url, events, secret? }
Response: { success: true, endpoint: IWebhookEndpoint }

// Get specific webhook
GET /api/arc/webhooks/:id
Response: { success: true, endpoint: IWebhookEndpoint }

// Update webhook
PATCH /api/arc/webhooks/:id
Body: { url?, enabled?, events?, maxRetries?, retryDelaySeconds? }
Response: { success: true, endpoint: IWebhookEndpoint }

// Delete webhook
DELETE /api/arc/webhooks/:id
Response: { success: true }
```

**All endpoints require admin authentication.**

### Integration Points

**Future Integration in arcExecutor.ts:**

1. **On Transfer Execution:**
   ```typescript
   await WebhookService.triggerEvent('arc.transfer', {
     executionId: execution._id,
     agentIndex: input.agentIndex,
     toAddress: input.toAddress,
     amount: input.amount,
     tokenAddress: input.tokenAddress,
   });
   ```

2. **On Confirmation:**
   ```typescript
   if (receiptStatus === 1 && confirmations >= ARC_CONFIRMATION_REQUIREMENT) {
     await WebhookService.triggerEvent('arc.confirmation', {
       executionId: execution._id.toString(),
       txHash: execution.txHash,
       agentIndex: execution.agentIndex,
       confirmations,
       blockNumber: minedBlock,
     });
   }
   ```

3. **On Failure:**
   ```typescript
   if (receiptStatus === 0) {
     await WebhookService.triggerEvent('arc.failure', {
       executionId: execution._id.toString(),
       txHash: execution.txHash,
       agentIndex: execution.agentIndex,
       reason: 'Transaction reverted on-chain',
     });
   }
   ```

---

## 3. Confirmation Queue

### Service

#### `ConfirmationQueue` Class ([src/services/confirmationQueue.ts](src/services/confirmationQueue.ts))

Manages retry/backoff queue for pending ARC transaction confirmations when RPC is temporarily unavailable.

**Design:**
- Exponential backoff with jitter to prevent thundering herd
- Automatic removal after max retries exceeded
- Callback-based processing for flexibility
- In-memory queue (suitable for browser/single-instance use)

**Configuration:**
```typescript
const queue = new ConfirmationQueue(
  processingCallback,
  {
    initialBackoffMs: 5000,      // Start with 5 seconds
    maxBackoffMs: 300000,         // Cap at 5 minutes
    maxRetries: 50,               // Up to ~1 hour total
  }
);
```

**Backoff Formula:**
```
backoff = min(initialBackoff * 2^retries, maxBackoff)
jitter = backoff * 0.2 * random(-1, 1)
delay = max(0, backoff + jitter)
```

**Public API:**
```typescript
// Add execution to queue
enqueue(executionId, txHash, agentIndex): void

// Remove from queue (e.g., when confirmed or failed)
dequeue(executionId): void

// Get pending items
getPending(): QueuedConfirmation[]

// Get queue size
size(): number

// Clear all items
clear(): void

// Get stats for monitoring
getStats(): {
  totalPending: number;
  readyNow: number;
  averageRetries: number;
  oldestItem: number; // ms since oldest item created
}
```

### Integration in ArcAgentsPanel

**Initialization:**
```typescript
const queueRef = useRef<ConfirmationQueue | null>(null);
const [queueStats, setQueueStats] = useState({
  totalPending: 0,
  readyNow: 0,
  averageRetries: 0,
  oldestItem: 0,
});

useEffect(() => {
  if (!queueRef.current) {
    queueRef.current = new ConfirmationQueue(
      async (executionIds) => {
        // Trigger journal refresh which polls confirmations from RPC
        await refreshJournal(true);
      },
      { initialBackoffMs: 5000, maxBackoffMs: 300000, maxRetries: 50 }
    );
  }
}, [refreshJournal]);
```

**Feeding Pending Transactions:**
```typescript
// In refreshJournal callback:
const pendingTxs = execResult.executions.filter(
  (e) => e.status === 'submitted' && e.txHash
);
for (const tx of pendingTxs) {
  if (tx.txHash) {
    queueRef.current.enqueue(tx._id, tx.txHash, tx.agentIndex);
  }
}

const stats = queueRef.current.getStats();
setQueueStats(stats);
```

**UI Display:**
```tsx
{queueStats.totalPending > 0 && (
  <span 
    className="text-[9px] text-amber-400"
    title={`${queueStats.readyNow} ready, avg ${queueStats.averageRetries.toFixed(1)} retries`}
  >
    ⏱ {queueStats.totalPending}
  </span>
)}
```

**How It Works:**

1. When `refreshJournal` is called with `withRefreshPoll=true`:
   - Fetches latest executions
   - Filters for `status='submitted'` transactions
   - Adds them to the confirmation queue

2. Queue processes items on schedule:
   - Initial delay: 5 seconds
   - On failure, retry with exponential backoff
   - Jitter prevents thundering herd
   - After 50 retries, item is removed with warning

3. When callback fires (item is ready):
   - Invokes `refreshJournal(true)` to poll RPC again
   - If RPC is back online, confirmations will be retrieved
   - If RPC still down, item re-queues with longer backoff

**Benefits:**
- ✅ Graceful handling of temporary RPC downtime
- ✅ Prevents overwhelming RPC with simultaneous requests
- ✅ Automatic exponential backoff
- ✅ Jitter prevents synchronized retry storms
- ✅ Real-time queue stats in UI
- ✅ Zero external dependencies

---

## Usage Examples

### 1. Editing a Policy

1. Expand the ARC panel
2. Hover over a policy row in the "ARC Policy Table"
3. Click the edit button (✎)
4. Modify desired settings:
   - Toggle agent enable/disable
   - Update transaction/daily limits
   - Adjust cooldown period
   - Add/remove allowlisted addresses
5. Click "Save"
6. Policy updates immediately in the table

### 2. Setting Up Webhooks (via API/CLI)

```bash
# Create a webhook for confirmations
curl -X POST http://localhost:3001/api/arc/webhooks \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-webhook",
    "url": "https://my-service.com/arc-events",
    "events": ["arc.confirmation", "arc.failure"],
    "maxRetries": 5,
    "retryDelaySeconds": 60
  }'

# List all webhooks
curl -X GET http://localhost:3001/api/arc/webhooks \
  -H "Authorization: Bearer <admin-token>"

# Disable a webhook
curl -X PATCH http://localhost:3001/api/arc/webhooks/:id \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

### 3. Receiving & Verifying Webhooks

```typescript
// Express handler example
app.post('/arc-events', (req, res) => {
  const signature = req.header('X-Webhook-Signature');
  const payload = JSON.stringify(req.body);
  
  // Verify signature using WebhookService
  const isValid = WebhookService.verifySignature(
    payload,
    signature,
    process.env.WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = req.body;
  console.log(`Received ${event.type} event`, event.data);
  
  res.json({ success: true });
});
```

---

## Configuration

### Environment Variables

```env
# Existing
VITE_ARC_RPC_KEY=<your-arc-rpc-key>
ARC_EXECUTOR_ENABLED=true
ARC_AGENT_WALLETS=<comma-separated-addresses>

# Webhook defaults (optional overrides)
ARC_WEBHOOK_MAX_RETRIES=5
ARC_WEBHOOK_RETRY_DELAY_SECONDS=60

# Confirmation Queue defaults (hardcoded, can be exposed if needed)
ARC_CONFIRMATION_QUEUE_INITIAL_BACKOFF_MS=5000
ARC_CONFIRMATION_QUEUE_MAX_BACKOFF_MS=300000
ARC_CONFIRMATION_QUEUE_MAX_RETRIES=50
```

### Database

Webhook endpoints are stored in MongoDB:
- Collection: `webhookendpoints`
- Indexes: `enabled`, `createdAt`

---

## Error Handling

### Policy Editing
- Invalid values show in-modal validation messages
- Save failures display as toast notification
- Modal remains open on error for retry

### Webhooks
- Failed deliveries tracked in `failureCount`
- Automatic exponential backoff with configurable limits
- All errors logged server-side

### Confirmation Queue
- Max retries exceeded logs warning and removes item
- Processing callback failures trigger re-queue
- Queue stats available for monitoring

---

## Future Enhancements

1. **UI Webhook Manager** - Add UI component to manage webhooks within ARC panel
2. **Queue Persistence** - Store queue to localStorage/IndexedDB for persistence across reloads
3. **Metrics & Monitoring** - Dashboard for queue stats, webhook delivery success rates
4. **Batch Processing** - Support batch confirmation checks for efficiency
5. **Dead Letter Queue** - Archive failed items for manual review
6. **Rate Limiting** - Configurable rate limits per webhook endpoint

---

## Testing

### Unit Tests
```bash
npm run test src/services/confirmationQueue.ts
npm run test src/components/PolicyEditor.tsx
```

### Integration Tests
```bash
# Test policy editing
npm run test:integration arc.policy.test.ts

# Test webhook delivery
npm run test:integration webhooks.test.ts
```

### Manual Testing Checklist
- [ ] Edit multiple policies in sequence
- [ ] Verify policy changes persist after panel refresh
- [ ] Trigger RPC unavailability and watch queue backoff
- [ ] Verify queue clears when RPC recovers
- [ ] Test webhook delivery with mock endpoint
- [ ] Verify HMAC signature validation
- [ ] Test retry exhaustion (50 retries)

---

## File Structure Summary

```
New Files:
├── src/components/PolicyEditor.tsx          # Policy edit modal
├── src/services/confirmationQueue.ts        # Retry/backoff queue
├── server/src/models/WebhookEndpoint.ts     # Webhook schema
└── server/src/services/webhookService.ts    # Webhook logic

Modified Files:
├── src/components/ArcAgentsPanel.tsx        # Integrated editing & queue
├── src/services/apiService.ts               # Added updateArcPolicy
└── server/src/routes/arc.ts                 # Added webhook endpoints
```

---

## Support & Debugging

**Enable Debug Logging:**
```typescript
// In confirmationQueue.ts or WebhookService
console.log('[ConfirmationQueue]', ...);
console.log('[WebhookService]', ...);
```

**Check Queue Status:**
```typescript
const stats = queueRef.current?.getStats();
console.log('Queue:', stats);
// { totalPending: 3, readyNow: 1, averageRetries: 2.3, oldestItem: 45000 }
```

**Monitor Webhook Deliveries:**
- Check MongoDB for `WebhookEndpoint.successCount` / `failureCount`
- Review server logs for delivery attempts and failures
- Inspect webhook response headers for debugging info
