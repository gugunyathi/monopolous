import { Router, Request, Response } from 'express';
import { AgentState } from '../models/AgentState.js';
import { Trade } from '../models/Trade.js';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore } from '../services/memoryStore.js';

const router = Router();

// ─── GET /api/agents ──────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  if (isDBConnected()) {
    try {
      const agents = await AgentState.find()
        .sort({ currentNetWorth: -1 })
        .limit(100)
        .lean();
      if (agents.length > 0) {
        res.json({ agents, count: agents.length });
        return;
      }
    } catch {}
  }

  const agents = Array.from(memoryStore.agentStates.values()).sort((a, b) => b.currentNetWorth - a.currentNetWorth);
  res.json({ agents, count: agents.length });
});

// ─── GET /api/agents/:index ───────────────────────────────────────────────────
router.get('/:index', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);

  if (isNaN(agentIndex) || agentIndex < 0 || agentIndex > 1999) {
    res.status(400).json({ error: 'Invalid agent index (0-1999)' });
    return;
  }

  if (isDBConnected()) {
    try {
      const agent = await AgentState.findOne({ agentIndex }).lean();
      if (agent) {
        const recentTrades = await Trade.find({ agentIndex })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean();

        const tokens = await TokenLaunch.find({ deployerAgentIndex: agentIndex })
          .sort({ deployedAt: -1 })
          .limit(10)
          .lean();

        res.json({ agent, recentTrades, tokens });
        return;
      }
    } catch {}
  }

  const agent = memoryStore.agentStates.get(agentIndex) ?? {
    agentIndex,
    currentBalance: 1500,
    peakBalance: 1500,
    propertiesOwned: [],
    currentTileIndex: 0,
    isInJail: false,
    totalTradesCount: 0,
    totalTokensLaunched: 0,
    isADKActive: true,
    currentRank: agentIndex + 1,
    currentNetWorth: 1500,
    lastActiveAt: new Date(),
  };

  const recentTrades = memoryStore.trades.filter((t) => t.agentIndex === agentIndex).slice(0, 10);
  const tokens = memoryStore.tokens.filter((t) => t.deployerAgentIndex === agentIndex).slice(0, 10);

  res.json({ agent, recentTrades, tokens });
});

// ─── POST /api/agents/state/batch ────────────────────────────────────────────
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

  // Update memory store
  for (const s of states) {
    if (typeof s.agentIndex === 'number') {
      const existing = memoryStore.agentStates.get(s.agentIndex) || {
        agentIndex: s.agentIndex,
        currentBalance: 1500,
        peakBalance: 1500,
        propertiesOwned: [],
        currentTileIndex: 0,
        isInJail: false,
        totalTradesCount: 0,
        totalTokensLaunched: 0,
        isADKActive: true,
        currentRank: s.agentIndex + 1,
        currentNetWorth: 1500,
        lastActiveAt: new Date(),
      };
      Object.assign(existing, s, { lastActiveAt: new Date() });
      memoryStore.agentStates.set(s.agentIndex, existing);
    }
  }

  if (isDBConnected()) {
    try {
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
    } catch {}
  }

  res.json({ success: true, updated: states.length });
});

// ─── PATCH /api/agents/:index ─────────────────────────────────────────────────
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

  const existing = memoryStore.agentStates.get(agentIndex) || {
    agentIndex,
    currentBalance: 1500,
    peakBalance: 1500,
    propertiesOwned: [],
    currentTileIndex: 0,
    isInJail: false,
    totalTradesCount: 0,
    totalTokensLaunched: 0,
    isADKActive: true,
    currentRank: agentIndex + 1,
    currentNetWorth: 1500,
    lastActiveAt: new Date(),
  };
  Object.assign(existing, updates);
  memoryStore.agentStates.set(agentIndex, existing);

  if (isDBConnected()) {
    try {
      await AgentState.updateOne({ agentIndex }, { $set: updates }, { upsert: true });
    } catch {}
  }

  res.json({ success: true });
});

// ─── GET /api/agents/:index/trades ───────────────────────────────────────────
router.get('/:index/trades', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);

  if (isDBConnected()) {
    try {
      const trades = await Trade.find({ agentIndex })
        .sort({ timestamp: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean();

      const total = await Trade.countDocuments({ agentIndex });
      res.json({ trades, total, page, limit });
      return;
    } catch {}
  }

  const allTrades = memoryStore.trades.filter((t) => t.agentIndex === agentIndex);
  const trades = allTrades.slice(page * limit, (page + 1) * limit);
  res.json({ trades, total: allTrades.length, page, limit });
});

export default router;
