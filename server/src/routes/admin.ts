import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { GameSession } from '../models/GameSession.js';
import { Trade } from '../models/Trade.js';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { SocialPost } from '../models/SocialPost.js';

const router = Router();

router.use(requireAdmin);

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeSessions,
      totalSessions,
      totalTrades,
      totalTokenLaunches,
      totalPosts,
      latestUsers,
    ] = await Promise.all([
      User.countDocuments(),
      GameSession.countDocuments({ isActive: true }),
      GameSession.countDocuments(),
      Trade.countDocuments(),
      TokenLaunch.countDocuments(),
      SocialPost.countDocuments(),
      User.find({}).sort({ lastActiveAt: -1 }).limit(8).select('address displayName totalGamesPlayed lastActiveAt'),
    ]);

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      counts: {
        users: totalUsers,
        sessions: totalSessions,
        activeSessions,
        trades: totalTrades,
        tokenLaunches: totalTokenLaunches,
        socialPosts: totalPosts,
      },
      latestUsers,
    });
  } catch {
    res.json({
      success: true,
      offline: true,
      generatedAt: new Date().toISOString(),
      counts: {
        users: 0,
        sessions: 0,
        activeSessions: 0,
        trades: 0,
        tokenLaunches: 0,
        socialPosts: 0,
      },
      latestUsers: [],
    });
  }
});

export default router;
