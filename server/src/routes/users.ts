import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';
import { Trade } from '../models/Trade.js';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { GameSession } from '../models/GameSession.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore } from '../services/memoryStore.js';

const router = Router();

// ─── GET /api/users/:address ─────────────────────────────────────────────────
router.get('/:address', async (req: Request, res: Response) => {
  const address = req.params.address.toLowerCase();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  if (isDBConnected()) {
    try {
      const user = await User.findOne({ address });
      if (user) {
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
        return;
      }
    } catch {}
  }

  const user = memoryStore.getOrCreateUser(address);
  const userSessions = Array.from(memoryStore.sessions.values())
    .filter((s) => s.userAddress === address)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 5);

  const tradeCount = memoryStore.trades.filter((t) => t.agentIndex === 0).length;
  const tokenCount = memoryStore.tokens.filter((t) => t.deployerAgentIndex === 0).length;

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
    recentSessions: userSessions,
  });
});

// ─── PATCH /api/users/me ─────────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const address = req.auth!.address.toLowerCase();
  const { displayName, avatarUrl, farcasterFid, farcasterUsername, ens } = req.body;

  const updates: Record<string, unknown> = {};
  if (typeof displayName === 'string') updates.displayName = displayName.slice(0, 50);
  if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.slice(0, 300);
  if (typeof farcasterFid === 'number') updates.farcasterFid = farcasterFid;
  if (typeof farcasterUsername === 'string') updates.farcasterUsername = farcasterUsername.slice(0, 50);
  if (typeof ens === 'string') updates.ens = ens.slice(0, 100);

  const user = memoryStore.getOrCreateUser(address);
  Object.assign(user, updates, { lastActiveAt: new Date() });

  if (isDBConnected()) {
    try {
      const dbUser = await User.findOneAndUpdate(
        { address },
        { $set: { ...updates, lastActiveAt: new Date() } },
        { new: true },
      );
      if (dbUser) {
        res.json({ address: dbUser.address, displayName: dbUser.displayName, ens: dbUser.ens });
        return;
      }
    } catch {}
  }

  res.json({ address: user.address, displayName: user.displayName, ens: user.ens });
});

// ─── GET /api/users/:address/history ─────────────────────────────────────────
router.get('/:address/history', async (req: Request, res: Response) => {
  const address = req.params.address.toLowerCase();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (isDBConnected()) {
    try {
      const sessions = await GameSession.find({ userAddress: address })
        .sort({ startedAt: -1 })
        .limit(limit)
        .lean();

      if (sessions.length > 0) {
        res.json({ sessions, count: sessions.length });
        return;
      }
    } catch {}
  }

  const sessions = Array.from(memoryStore.sessions.values())
    .filter((s) => s.userAddress === address)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit);

  res.json({ sessions, count: sessions.length });
});

export default router;
