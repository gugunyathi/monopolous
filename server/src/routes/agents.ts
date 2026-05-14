import { Router, Request, Response } from 'express';
import { AgentState } from '../models/AgentState';
import { Trade } from '../models/Trade';
import { TokenLaunch } from '../models/TokenLaunch';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── GET /api/agents ──────────────────────────────────────────────────────────
// List all persisted agent states (sorted by net worth)
router.get('/', async (_req: Request, res: Response) => {
  const agents = await AgentState.find()
    .sort({ currentNetWorth: -1 })
    .limit(100)
    .lean();
  res.json({ agents, count: agents.length });
});

// ─── GET /api/agents/:index ───────────────────────────────────────────────────
router.get('/:index', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);

  if (isNaN(agentIndex) || agentIndex < 0 || agentIndex > 1999) {
    res.status(400).json({ error: 'Invalid agent index (0-1999)' });
    return;
  }

  const agent = await AgentState.findOne({ agentIndex }).lean();
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  // Recent trades for this agent
  const recentTrades = await Trade.find({ agentIndex })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  // Tokens launched by this agent
  const tokens = await TokenLaunch.find({ deployerAgentIndex: agentIndex })
    .sort({ deployedAt: -1 })
    .limit(10)
    .lean();

  res.json({ agent, recentTrades, tokens });
});

// ─── POST /api/agents/state/batch ────────────────────────────────────────────
// Batch-upsert agent states (called by frontend periodically)
router.post('/state/batch', requireAuth, async (req: Request, res: Response) => {
  const { states } = req.body;

  if (!Array.isArray(states) || states.length === 0) {
    res.status(400).json({ error: 'states array is required' });
    return;
  }

  if (states.length > 100) {
    res.status(400).json({ error: 'Maximum 100 agent states per batch' });
    return;
  }

  const ops = states.map((s: Record<string, unknown>) => ({
    updateOne: {
      filter: { agentIndex: s.agentIndex },
      update: {
        $set: {
          sessionId: s.sessionId,
          currentBalance: s.currentBalance,
          peakBalance: s.peakBalance,
          propertiesOwned: s.propertiesOwned,
          currentTileIndex: s.currentTileIndex,
          isInJail: s.isInJail,
          totalTradesCount: s.totalTradesCount,
          totalTokensLaunched: s.totalTokensLaunched,
          isADKActive: s.isADKActive,
          currentRank: s.currentRank,
          currentNetWorth: s.currentNetWorth,
          lastActiveAt: new Date(),
        },
      } as Record<string, unknown>,
      upsert: true,
    },
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await AgentState.bulkWrite(ops as any);
  res.json({ success: true, updated: ops.length });
});

// ─── PATCH /api/agents/:index ─────────────────────────────────────────────────
// Update single agent state (called on meaningful events)
router.patch('/:index', requireAuth, async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);

  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  const allowed = [
    'currentBalance', 'peakBalance', 'propertiesOwned', 'currentTileIndex',
    'isInJail', 'jailTurnsRemaining', 'totalTradesCount', 'totalTokensLaunched',
    'totalPolymarketBets', 'totalX402Payments', 'totalRentCollected', 'totalRentPaid',
    'isADKActive', 'adkActionsCount', 'currentRank', 'currentNetWorth',
    'bnkrWalletId', 'bnkrMasterAddress', 'allocatedBalance',
  ];

  const updates: Record<string, unknown> = { lastActiveAt: new Date() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  await AgentState.updateOne({ agentIndex }, { $set: updates }, { upsert: true });
  res.json({ success: true });
});

// ─── GET /api/agents/:index/trades ───────────────────────────────────────────
router.get('/:index/trades', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);

  const trades = await Trade.find({ agentIndex })
    .sort({ timestamp: -1 })
    .skip(page * limit)
    .limit(limit)
    .lean();

  const total = await Trade.countDocuments({ agentIndex });
  res.json({ trades, total, page, limit });
});

export default router;
