import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { GameSession } from '../models/GameSession';
import { Trade } from '../models/Trade';
import { TokenLaunch } from '../models/TokenLaunch';
import { SocialPost } from '../models/SocialPost';

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
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load admin overview.' });
  }
});

export default router;
