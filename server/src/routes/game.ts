import { Router, Request, Response } from 'express';
import { GameSession } from '../models/GameSession';
import { AgentState } from '../models/AgentState';
import { Trade } from '../models/Trade';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── POST /api/game/sessions ──────────────────────────────────────────────────
// Start a new game session when player connects wallet
router.post('/sessions', requireAuth, async (req: Request, res: Response) => {
  const { startBalance } = req.body;
  const address = req.auth!.address;

  // End any existing active session for this user
  await GameSession.updateMany(
    { userAddress: address, isActive: true },
    { $set: { isActive: false, endedAt: new Date() } },
  );

  const sessionId = uuidv4();
  const session = await GameSession.create({
    sessionId,
    userAddress: address,
    startBalance: startBalance ?? 1500,
    peakBalance: startBalance ?? 1500,
    lowestBalance: startBalance ?? 1500,
    startedAt: new Date(),
    isActive: true,
  });

  // Update user's lastSessionId
  await User.updateOne(
    { address },
    { $set: { lastSessionId: sessionId, lastActiveAt: new Date() } },
  );

  res.status(201).json({ sessionId: session.sessionId, success: true });
});

// ─── PATCH /api/game/sessions/:sessionId ─────────────────────────────────────
// Update session stats (called periodically)
router.patch('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const address = req.auth!.address;

  const allowed = [
    'endBalance', 'peakBalance', 'lowestBalance', 'propertiesOwned', 'totalPropertyValue',
    'tradesCount', 'tokensLaunched', 'polymarketBets', 'broadcastsSent', 'x402PaymentsMade',
    'finalRank', 'finalNetWorth',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const session = await GameSession.findOneAndUpdate(
    { sessionId, userAddress: address },
    { $set: updates },
    { new: true },
  );

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({ success: true });
});

// ─── POST /api/game/sessions/:sessionId/end ───────────────────────────────────
// End a game session and record final stats
router.post('/sessions/:sessionId/end', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const address = req.auth!.address;
  const { finalBalance, finalRank, finalNetWorth, propertiesOwned, totalPropertyValue } = req.body;

  const session = await GameSession.findOneAndUpdate(
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

  if (!session) {
    res.status(404).json({ error: 'Active session not found' });
    return;
  }

  // Update user all-time stats
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

  res.json({ success: true, sessionId });
});

// ─── GET /api/game/sessions/:sessionId ───────────────────────────────────────
router.get('/sessions/:sessionId', requireAuth, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = await GameSession.findOne({ sessionId }).lean();

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json(session);
});

// ─── GET /api/game/leaderboard ────────────────────────────────────────────────
// Current leaderboard from AgentState
router.get('/leaderboard', async (_req: Request, res: Response) => {
  const agents = await AgentState.find()
    .sort({ currentNetWorth: -1 })
    .limit(20)
    .select('agentIndex currentBalance currentNetWorth propertiesOwned totalTradesCount currentRank')
    .lean();

  res.json({ leaderboard: agents, updatedAt: new Date() });
});

// ─── GET /api/game/leaderboard/all-time ──────────────────────────────────────
// All-time best performers from ended game sessions
router.get('/leaderboard/all-time', async (_req: Request, res: Response) => {
  const top = await GameSession.find({ isActive: false, finalNetWorth: { $exists: true } })
    .sort({ finalNetWorth: -1 })
    .limit(20)
    .select('userAddress finalNetWorth finalRank endedAt tradesCount tokensLaunched')
    .lean();

  res.json({ leaderboard: top });
});

// ─── POST /api/game/properties ────────────────────────────────────────────────
// Record a property purchase
router.post('/properties', requireAuth, async (req: Request, res: Response) => {
  const { agentIndex, tileId, tileName, purchasePrice, sessionId } = req.body;

  if (agentIndex === undefined || !tileId || !sessionId) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Record as a trade event
  const { balanceBefore, balanceAfter } = req.body;
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

  // Update agent properties list
  await AgentState.updateOne(
    { agentIndex },
    {
      $addToSet: { propertiesOwned: tileId },
      $set: { currentBalance: balanceAfter, lastActiveAt: new Date() },
      $inc: { totalSpent: purchasePrice ?? 0 },
    },
    { upsert: true },
  );

  // Update game session
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

  res.status(201).json({ success: true });
});

export default router;
