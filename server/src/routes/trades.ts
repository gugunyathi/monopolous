import { Router, Request, Response } from 'express';
import { Trade } from '../models/Trade.js';
import { AgentState } from '../models/AgentState.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore, type InMemoryTrade } from '../services/memoryStore.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── POST /api/trades ─────────────────────────────────────────────────────────
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

  const tradeId = uuidv4();
  const memTrade: InMemoryTrade = {
    _id: tradeId,
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
  };

  memoryStore.trades.unshift(memTrade);

  // Update agent state in memory
  const agent = memoryStore.agentStates.get(agentIndex);
  if (agent) {
    agent.totalTradesCount += 1;
    if (balanceAfter !== undefined) {
      agent.currentBalance = balanceAfter;
      if (balanceAfter > agent.peakBalance) agent.peakBalance = balanceAfter;
    }
    agent.lastActiveAt = new Date();
  }

  if (isDBConnected()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trade = await Trade.create(memTrade as any);

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

      res.status(201).json({ id: trade ? trade._id : tradeId, success: true });
      return;
    } catch {}
  }

  res.status(201).json({ id: tradeId, success: true });
});

// ─── POST /api/trades/batch ───────────────────────────────────────────────────
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
    _id: uuidv4(),
    sessionId: t.sessionId as string,
    agentIndex: t.agentIndex as number,
    tradeType: (t.tradeType as string) ?? 'swap',
    fromToken: t.fromToken as string,
    toToken: t.toToken as string,
    fromAmount: t.fromAmount as number,
    toAmount: t.toAmount as number | undefined,
    balanceBefore: t.balanceBefore as number | undefined,
    balanceAfter: t.balanceAfter as number | undefined,
    pnl: (typeof t.balanceAfter === 'number' && typeof t.balanceBefore === 'number')
      ? t.balanceAfter - t.balanceBefore : undefined,
    txHash: t.txHash as string | undefined,
    bankrJobId: t.bankrJobId as string | undefined,
    chain: (t.chain as string) ?? 'base',
    simulated: (t.simulated as boolean) ?? true,
    triggerReason: (t.triggerReason as string) ?? 'autonomous',
    traderPersonality: t.traderPersonality as string | undefined,
    timestamp: t.timestamp ? new Date(t.timestamp as string) : new Date(),
  }));

  for (const d of docs) {
    memoryStore.trades.unshift(d);
  }

  if (isDBConnected()) {
    try {
      await Trade.insertMany(docs, { ordered: false });
    } catch {}
  }

  res.status(201).json({ success: true, inserted: docs.length });
});

// ─── GET /api/trades ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);
  const { sessionId, agentIndex, fromToken, toToken, simulated } = req.query;

  if (isDBConnected()) {
    try {
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

      if (trades.length > 0 || total > 0) {
        res.json({ trades, total, page, limit });
        return;
      }
    } catch {}
  }

  let filtered = [...memoryStore.trades];
  if (sessionId) filtered = filtered.filter((t) => t.sessionId === sessionId);
  if (agentIndex !== undefined) {
    const idx = parseInt(agentIndex as string);
    filtered = filtered.filter((t) => t.agentIndex === idx);
  }
  if (fromToken) {
    const ft = (fromToken as string).toUpperCase();
    filtered = filtered.filter((t) => t.fromToken.toUpperCase() === ft);
  }
  if (toToken) {
    const tt = (toToken as string).toUpperCase();
    filtered = filtered.filter((t) => t.toToken.toUpperCase() === tt);
  }
  if (simulated !== undefined) {
    const sim = simulated === 'true';
    filtered = filtered.filter((t) => t.simulated === sim);
  }

  const paginated = filtered.slice(page * limit, (page + 1) * limit);
  res.json({ trades: paginated, total: filtered.length, page, limit });
});

// ─── GET /api/trades/stats ───────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  const { sessionId } = req.query;

  if (isDBConnected()) {
    try {
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
      if (stats.length > 0) {
        res.json({ stats });
        return;
      }
    } catch {}
  }

  const groupMap = new Map<number, { _id: number; totalTrades: number; totalVolume: number; totalPnl: number; realTrades: number }>();
  for (const t of memoryStore.trades) {
    if (sessionId && t.sessionId !== sessionId) continue;
    const existing = groupMap.get(t.agentIndex) || {
      _id: t.agentIndex,
      totalTrades: 0,
      totalVolume: 0,
      totalPnl: 0,
      realTrades: 0,
    };
    existing.totalTrades++;
    existing.totalVolume += t.fromAmount || 0;
    existing.totalPnl += t.pnl || 0;
    if (!t.simulated) existing.realTrades++;
    groupMap.set(t.agentIndex, existing);
  }

  const stats = Array.from(groupMap.values()).map((g) => ({
    ...g,
    avgTradeSize: g.totalTrades > 0 ? g.totalVolume / g.totalTrades : 0,
  })).sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 20);

  res.json({ stats });
});

export default router;
