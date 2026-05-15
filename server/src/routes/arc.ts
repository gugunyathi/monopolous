import { Request, Response, Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { ArcExecution } from '../models/ArcExecution.js';
import {
  executeArcTransfer,
  getArcExecutorStatus,
  listArcAgentWallets,
  listArcPolicies,
  refreshArcExecutionConfirmations,
  updateArcPolicy,
} from '../services/arcExecutor.js';
import { WebhookService } from '../services/webhookService.js';

const router = Router();

router.get('/status', requireAdmin, async (_req: Request, res: Response) => {
  const policies = await listArcPolicies();
  res.json({
    success: true,
    status: getArcExecutorStatus(),
    wallets: listArcAgentWallets(),
    policies,
  });
});

router.get('/executions', requireAdmin, async (req: Request, res: Response) => {
  const refresh = String(req.query.refresh ?? '').toLowerCase() === 'true';
  let refreshSummary: Awaited<ReturnType<typeof refreshArcExecutionConfirmations>> | null = null;

  if (refresh) {
    const refreshLimit = Math.min(Math.max(parseInt(String(req.query.refreshLimit ?? '20'), 10), 1), 100);
    refreshSummary = await refreshArcExecutionConfirmations(refreshLimit);
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10), 1), 100);
  const docs = await ArcExecution.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ success: true, executions: docs, refresh: refreshSummary });
});

router.post('/executions/refresh', requireAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.body?.limit ?? '20'), 10), 1), 100);
  const refresh = await refreshArcExecutionConfirmations(limit);
  res.json({ success: true, refresh });
});

router.get('/policies', requireAdmin, async (_req: Request, res: Response) => {
  const policies = await listArcPolicies();
  res.json({ success: true, policies });
});

router.patch('/policies/:agentIndex', requireAdmin, async (req: Request, res: Response) => {
  try {
    const agentIndex = Number(req.params.agentIndex);
    if (!Number.isInteger(agentIndex) || agentIndex < 0) {
      res.status(400).json({ error: 'Invalid agentIndex' });
      return;
    }

    const policy = await updateArcPolicy(agentIndex, req.body ?? {});
    res.json({ success: true, policy });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update ARC policy' });
  }
});

router.post('/transfer/estimate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { agentIndex, toAddress, amount, tokenAddress, reason } = req.body as {
      agentIndex?: number;
      toAddress?: string;
      amount?: string;
      tokenAddress?: string;
      reason?: string;
    };

    if (typeof agentIndex !== 'number' || !toAddress || !amount) {
      res.status(400).json({ error: 'agentIndex, toAddress, and amount are required' });
      return;
    }

    const result = await executeArcTransfer({
      agentIndex,
      toAddress,
      amount,
      tokenAddress,
      reason,
      estimateOnly: true,
      requestedBy: req.auth?.address ?? 'unknown',
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'ARC estimate failed' });
  }
});

router.post('/transfer/execute', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { agentIndex, toAddress, amount, tokenAddress, reason } = req.body as {
      agentIndex?: number;
      toAddress?: string;
      amount?: string;
      tokenAddress?: string;
      reason?: string;
    };

    if (typeof agentIndex !== 'number' || !toAddress || !amount) {
      res.status(400).json({ error: 'agentIndex, toAddress, and amount are required' });
      return;
    }

    const result = await executeArcTransfer({
      agentIndex,
      toAddress,
      amount,
      tokenAddress,
      reason,
      estimateOnly: false,
      requestedBy: req.auth?.address ?? 'unknown',
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'ARC transfer failed' });
  }
});

// ─── Webhooks (for push confirmations) ────────────────────────────────────────

router.get('/webhooks', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const endpoints = await WebhookService.listEndpoints();
    res.json({ success: true, endpoints });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list webhooks' });
  }
});

router.post('/webhooks', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, url, events, secret } = req.body as {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
    };

    if (!name || !url || !events || events.length === 0) {
      res.status(400).json({ error: 'name, url, and events are required' });
      return;
    }

    const endpoint = await WebhookService.upsertEndpoint(name, url, events, secret);
    res.json({ success: true, endpoint });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create webhook' });
  }
});

router.get('/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const endpoint = await WebhookService.getEndpoint(req.params.id);
    if (!endpoint) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json({ success: true, endpoint });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get webhook' });
  }
});

router.patch('/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const endpoint = await WebhookService.updateEndpoint(req.params.id, req.body ?? {});
    if (!endpoint) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json({ success: true, endpoint });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update webhook' });
  }
});

router.delete('/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await WebhookService.deleteEndpoint(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete webhook' });
  }
});

export default router;
