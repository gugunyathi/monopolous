import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { Trade } from '../models/Trade';
import { TokenLaunch } from '../models/TokenLaunch';
import { GameSession } from '../models/GameSession';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── GET /api/users/:address ─────────────────────────────────────────────────
router.get('/:address', async (req: Request, res: Response) => {
  const address = req.params.address.toLowerCase();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  const user = await User.findOne({ address });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Enrich with recent stats
  const [tradeCount, tokenCount, sessions] = await Promise.all([
    Trade.countDocuments({ agentIndex: 0, sessionId: { $in: await GameSession.find({ userAddress: address }).distinct('sessionId') } }),
    TokenLaunch.countDocuments({ deployerAgentIndex: 0 }),
    GameSession.find({ userAddress: address }).sort({ startedAt: -1 }).limit(5).select('-__v'),
  ]);

  res.json({
    address: user.address,
    ens: user.ens,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    totalGamesPlayed: user.totalGamesPlayed,
    totalTradesExecuted: tradeCount,
    totalTokensLaunched: tokenCount,
    allTimeBestBalance: user.allTimeBestBalance,
    firstLoginAt: user.firstLoginAt,
    lastActiveAt: user.lastActiveAt,
    farcasterUsername: user.farcasterUsername,
    recentSessions: sessions,
  });
});

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const address = req.auth!.address;
  const { displayName, avatarUrl, farcasterFid, farcasterUsername, ens } = req.body;

  // Only allow updating safe fields
  const updates: Record<string, unknown> = {};
  if (typeof displayName === 'string') updates.displayName = displayName.slice(0, 50);
  if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.slice(0, 300);
  if (typeof farcasterFid === 'number') updates.farcasterFid = farcasterFid;
  if (typeof farcasterUsername === 'string') updates.farcasterUsername = farcasterUsername.slice(0, 50);
  if (typeof ens === 'string') updates.ens = ens.slice(0, 100);

  const user = await User.findOneAndUpdate(
    { address },
    { $set: { ...updates, lastActiveAt: new Date() } },
    { new: true },
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ address: user.address, displayName: user.displayName, ens: user.ens });
});

// ─── GET /api/users/:address/history ─────────────────────────────────────────
router.get('/:address/history', async (req: Request, res: Response) => {
  const address = req.params.address.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const sessions = await GameSession.find({ userAddress: address })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();

  res.json({ sessions, count: sessions.length });
});

export default router;
