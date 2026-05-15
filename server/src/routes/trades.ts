import { Router, Request, Response } from 'express';
import { Trade } from '../models/Trade.js';
import { AgentState } from '../models/AgentState.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── POST /api/trades ─────────────────────────────────────────────────────────
// Record a new trade (called by BehaviorManager / ADK orchestrator)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    sessionId, agentIndex, tradeType,
    fromToken, toToken, fromAmount, toAmount,
    balanceBefore, balanceAfter,
    txHash, bankrJobId, chain, simulated,
    triggerReason, traderPersonality,
  } = req.body;

  if (!sessionId || agentIndex === undefined || !fromToken || !toToken || fromAmount === undefined) {
    res.status(400).json({ error: 'Missing required fields: sessionId, agentIndex, fromToken, toToken, fromAmount' });
    return;
  }

  const trade = await Trade.create({
    sessionId,
    agentIndex,
    tradeType: tradeType ?? 'swap',
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    balanceBefore,
    balanceAfter,
    pnl: balanceBefore !== undefined && balanceAfter !== undefined ? balanceAfter - balanceBefore : undefined,
    txHash,
    bankrJobId,
    chain: chain ?? 'base',
    simulated: simulated ?? true,
    triggerReason: triggerReason ?? 'autonomous',
    traderPersonality,
    timestamp: new Date(),
  });

  // Update agent stats
  await AgentState.updateOne(
    { agentIndex },
    {
      $inc: { totalTradesCount: 1 },
      $set: {
        currentBalance: balanceAfter,
        lastActiveAt: new Date(),
      },
      $max: { peakBalance: balanceAfter },
    },
    { upsert: true },
  );

  res.status(201).json({ id: trade._id, success: true });
});

// ─── POST /api/trades/batch ───────────────────────────────────────────────────
// Batch-insert multiple trades (performance optimization)
router.post('/batch', requireAuth, async (req: Request, res: Response) => {
  const { trades } = req.body;

  if (!Array.isArray(trades) || trades.length === 0) {
    res.status(400).json({ error: 'trades array is required' });
    return;
  }

  if (trades.length > 500) {
    res.status(400).json({ error: 'Maximum 500 trades per batch' });
    return;
  }

  const docs = trades.map((t: Record<string, unknown>) => ({
    sessionId: t.sessionId,
    agentIndex: t.agentIndex,
    tradeType: t.tradeType ?? 'swap',
    fromToken: t.fromToken,
    toToken: t.toToken,
    fromAmount: t.fromAmount,
    toAmount: t.toAmount,
    balanceBefore: t.balanceBefore,
    balanceAfter: t.balanceAfter,
    pnl: (typeof t.balanceAfter === 'number' && typeof t.balanceBefore === 'number')
      ? t.balanceAfter - t.balanceBefore : undefined,
    txHash: t.txHash,
    bankrJobId: t.bankrJobId,
    chain: t.chain ?? 'base',
    simulated: t.simulated ?? true,
    triggerReason: t.triggerReason ?? 'autonomous',
    traderPersonality: t.traderPersonality,
    timestamp: t.timestamp ? new Date(t.timestamp as string) : new Date(),
  }));

  await Trade.insertMany(docs, { ordered: false });
  res.status(201).json({ success: true, inserted: docs.length });
});

// ─── GET /api/trades ──────────────────────────────────────────────────────────
// List trades with filtering
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);
  const { sessionId, agentIndex, fromToken, toToken, simulated } = req.query;

  const filter: Record<string, unknown> = {};
  if (sessionId) filter.sessionId = sessionId;
  if (agentIndex !== undefined) filter.agentIndex = parseInt(agentIndex as string);
  if (fromToken) filter.fromToken = (fromToken as string).toUpperCase();
  if (toToken) filter.toToken = (toToken as string).toUpperCase();
  if (simulated !== undefined) filter.simulated = simulated === 'true';

  const [trades, total] = await Promise.all([
    Trade.find(filter).sort({ timestamp: -1 }).skip(page * limit).limit(limit).lean(),
    Trade.countDocuments(filter),
  ]);

  res.json({ trades, total, page, limit });
});

// ─── GET /api/trades/stats ───────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  const { sessionId } = req.query;
  const filter = sessionId ? { sessionId } : {};

  const stats = await Trade.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$agentIndex',
        totalTrades: { $sum: 1 },
        totalVolume: { $sum: '$fromAmount' },
        avgTradeSize: { $avg: '$fromAmount' },
        totalPnl: { $sum: '$pnl' },
        realTrades: { $sum: { $cond: [{ $eq: ['$simulated', false] }, 1, 0] } },
      },
    },
    { $sort: { totalVolume: -1 } },
    { $limit: 20 },
  ]);

  res.json({ stats });
});

export default router;
