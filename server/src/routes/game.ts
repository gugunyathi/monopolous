import { Router, Request, Response } from 'express';
import { GameSession } from '../models/GameSession.js';
import { AgentState } from '../models/AgentState.js';
import { Trade } from '../models/Trade.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore, type InMemoryGameSession } from '../services/memoryStore.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── POST /api/game/sessions ──────────────────────────────────────────────────
router.post('/sessions', requireAuth, async (req: Request, res: Response) => {
  const { startBalance } = req.body;
  const address = req.auth!.address.toLowerCase();

  // End any existing active session in memory
  for (const s of memoryStore.sessions.values()) {
    if (s.userAddress === address && s.isActive) {
      s.isActive = false;
      s.endedAt = new Date();
    }
  }

  const sessionId = uuidv4();
  const session: InMemoryGameSession = {
    sessionId,
    userAddress: address,
    startBalance: startBalance ?? 1500,
    peakBalance: startBalance ?? 1500,
    lowestBalance: startBalance ?? 1500,
    propertiesOwned: [],
    totalPropertyValue: 0,
    tradesCount: 0,
    tokensLaunched: 0,
    polymarketBets: 0,
    broadcastsSent: 0,
    x402PaymentsMade: 0,
    startedAt: new Date(),
    isActive: true,
  };

  memoryStore.sessions.set(sessionId, session);
  const user = memoryStore.getOrCreateUser(address);
  user.lastSessionId = sessionId;
  user.lastActiveAt = new Date();

  if (isDBConnected()) {
    try {
      await GameSession.updateMany(
        { userAddress: address, isActive: true },
        { $set: { isActive: false, endedAt: new Date() } },
      );

      await GameSession.create({
        sessionId,
        userAddress: address,
        startBalance: startBalance ?? 1500,
        peakBalance: startBalance ?? 1500,
        lowestBalance: startBalance ?? 1500,
        startedAt: new Date(),
        isActive: true,
      });

      await User.updateOne(
        { address },
        { $set: { lastSessionId: sessionId, lastActiveAt: new Date() } },
      );
    } catch {}
  }

  res.status(201).json({ sessionId: session.sessionId, success: true });
});

// ─── PATCH /api/game/sessions/:sessionId ─────────────────────────────────────
router.patch('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const address = req.auth!.address.toLowerCase();

  const allowed = [
    'endBalance', 'peakBalance', 'lowestBalance', 'propertiesOwned', 'totalPropertyValue',
    'tradesCount', 'tokensLaunched', 'polymarketBets', 'broadcastsSent', 'x402PaymentsMade',
    'finalRank', 'finalNetWorth',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const session = memoryStore.sessions.get(sessionId);
  if (session && session.userAddress === address) {
    Object.assign(session, updates);
  }

  if (isDBConnected()) {
    try {
      await GameSession.findOneAndUpdate(
        { sessionId, userAddress: address },
        { $set: updates },
        { new: true },
      );
    } catch {}
  }

  res.json({ success: true });
});

// ─── POST /api/game/sessions/:sessionId/end ───────────────────────────────────
router.post('/sessions/:sessionId/end', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const address = req.auth!.address.toLowerCase();
  const { finalBalance, finalRank, finalNetWorth, propertiesOwned, totalPropertyValue } = req.body;

  const session = memoryStore.sessions.get(sessionId);
  if (session) {
    session.isActive = false;
    session.endedAt = new Date();
    session.endBalance = finalBalance;
    session.finalRank = finalRank;
    session.finalNetWorth = finalNetWorth;
    if (propertiesOwned) session.propertiesOwned = propertiesOwned;
    if (totalPropertyValue !== undefined) session.totalPropertyValue = totalPropertyValue;
  }

  const user = memoryStore.getOrCreateUser(address);
  if (typeof finalBalance === 'number') {
    if (finalBalance > user.allTimeBestBalance) user.allTimeBestBalance = finalBalance;
    if (finalBalance < user.allTimeWorstBalance) user.allTimeWorstBalance = finalBalance;
    user.lastActiveAt = new Date();
  }

  if (isDBConnected()) {
    try {
      await GameSession.findOneAndUpdate(
        { sessionId, userAddress: address, isActive: true },
        {
          $set: {
            isActive: false,
            endedAt: new Date(),
            endBalance: finalBalance,
            finalRank,
            finalNetWorth,
            propertiesOwned: propertiesOwned ?? [],
            totalPropertyValue: totalPropertyValue ?? 0,
          },
        },
        { new: true },
      );

      if (typeof finalBalance === 'number') {
        await User.updateOne(
          { address },
          {
            $max: { allTimeBestBalance: finalBalance },
            $min: { allTimeWorstBalance: finalBalance },
            $set: { lastActiveAt: new Date() },
          },
        );
      }
    } catch {}
  }

  res.json({ success: true, sessionId });
});

// ─── GET /api/game/sessions/:sessionId ───────────────────────────────────────
router.get('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (isDBConnected()) {
    try {
      const dbSession = await GameSession.findOne({ sessionId }).lean();
      if (dbSession) {
        res.json(dbSession);
        return;
      }
    } catch {}
  }

  const session = memoryStore.sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json(session);
});

// ─── GET /api/game/leaderboard ────────────────────────────────────────────────
router.get('/leaderboard', async (_req: Request, res: Response) => {
  if (isDBConnected()) {
    try {
      const agents = await AgentState.find()
        .sort({ currentNetWorth: -1 })
        .limit(20)
        .select('agentIndex currentBalance currentNetWorth propertiesOwned totalTradesCount currentRank')
        .lean();

      if (agents.length > 0) {
        res.json({ leaderboard: agents, updatedAt: new Date() });
        return;
      }
    } catch {}
  }

  const agents = Array.from(memoryStore.agentStates.values())
    .sort((a, b) => b.currentNetWorth - a.currentNetWorth)
    .slice(0, 20)
    .map((a) => ({
      agentIndex: a.agentIndex,
      currentBalance: a.currentBalance,
      currentNetWorth: a.currentNetWorth,
      propertiesOwned: a.propertiesOwned,
      totalTradesCount: a.totalTradesCount,
      currentRank: a.currentRank,
    }));

  res.json({ leaderboard: agents, updatedAt: new Date() });
});

// ─── GET /api/game/leaderboard/all-time ──────────────────────────────────────
router.get('/leaderboard/all-time', async (_req: Request, res: Response) => {
  if (isDBConnected()) {
    try {
      const top = await GameSession.find({ isActive: false, finalNetWorth: { $exists: true } })
        .sort({ finalNetWorth: -1 })
        .limit(20)
        .select('userAddress finalNetWorth finalRank endedAt tradesCount tokensLaunched')
        .lean();

      if (top.length > 0) {
        res.json({ leaderboard: top });
        return;
      }
    } catch {}
  }

  const ended = Array.from(memoryStore.sessions.values())
    .filter((s) => !s.isActive && s.finalNetWorth !== undefined)
    .sort((a, b) => (b.finalNetWorth || 0) - (a.finalNetWorth || 0))
    .slice(0, 20)
    .map((s) => ({
      userAddress: s.userAddress,
      finalNetWorth: s.finalNetWorth,
      finalRank: s.finalRank,
      endedAt: s.endedAt,
      tradesCount: s.tradesCount,
      tokensLaunched: s.tokensLaunched,
    }));

  res.json({ leaderboard: ended });
});

// ─── POST /api/game/properties ────────────────────────────────────────────────
router.post('/properties', requireAuth, async (req: Request, res: Response) => {
  const { agentIndex, tileId, tileName, purchasePrice, sessionId, balanceBefore, balanceAfter } = req.body;

  if (agentIndex === undefined || !tileId || !sessionId) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const agent = memoryStore.agentStates.get(agentIndex);
  if (agent) {
    if (!agent.propertiesOwned.includes(tileId)) {
      agent.propertiesOwned.push(tileId);
    }
    if (balanceAfter !== undefined) agent.currentBalance = balanceAfter;
    agent.lastActiveAt = new Date();
  }

  if (isDBConnected()) {
    try {
      if (balanceBefore !== undefined && balanceAfter !== undefined) {
        await Trade.create({
          sessionId,
          agentIndex,
          tradeType: 'buy',
          fromToken: 'USDC',
          toToken: `PROPERTY:${tileId}`,
          fromAmount: purchasePrice ?? 0,
          balanceBefore,
          balanceAfter,
          pnl: 0,
          chain: 'game',
          simulated: true,
          triggerReason: 'tile_landing',
          timestamp: new Date(),
        });
      }

      await AgentState.updateOne(
        { agentIndex },
        {
          $addToSet: { propertiesOwned: tileId },
          $set: { currentBalance: balanceAfter, lastActiveAt: new Date() },
          $inc: { totalSpent: purchasePrice ?? 0 },
        },
        { upsert: true },
      );

      if (agentIndex === 0) {
        await GameSession.updateOne(
          { sessionId, isActive: true },
          {
            $push: {
              propertiesOwned: {
                tileId,
                tileName,
                purchasedAt: new Date(),
                purchasePrice,
              },
            },
            $inc: { totalPropertyValue: purchasePrice ?? 0 },
          },
        );
      }
    } catch {}
  }

  res.status(201).json({ success: true });
});

export default router;
