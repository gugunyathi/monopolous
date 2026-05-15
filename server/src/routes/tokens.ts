import { Router, Request, Response } from 'express';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { AgentState } from '../models/AgentState.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── POST /api/tokens ─────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    sessionId, deployerAgentIndex, deployerAddress,
    tokenName, tokenSymbol, tokenAddress, poolId,
    txHash, activityId, chain, simulated,
    description, imageUrl, feeRecipientAddress,
  } = req.body;

  if (!sessionId || deployerAgentIndex === undefined || !tokenName || !tokenAddress || !poolId) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Validate token address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    res.status(400).json({ error: 'Invalid token address format' });
    return;
  }

  const token = await TokenLaunch.create({
    sessionId,
    deployerAgentIndex,
    deployerAddress: deployerAddress?.toLowerCase(),
    tokenName,
    tokenSymbol: tokenSymbol?.toUpperCase() ?? tokenName.slice(0, 6).toUpperCase(),
    tokenAddress: tokenAddress.toLowerCase(),
    poolId,
    txHash,
    activityId,
    chain: chain ?? 'base',
    simulated: simulated ?? false,
    description,
    imageUrl,
    feeRecipientAddress: feeRecipientAddress?.toLowerCase(),
    totalFeesClaimed: 0,
    deployedAt: new Date(),
  });

  // Update agent stats
  await AgentState.updateOne(
    { agentIndex: deployerAgentIndex },
    { $inc: { totalTokensLaunched: 1 }, $set: { lastActiveAt: new Date() } },
    { upsert: true },
  );

  // Update user stats if player
  if (deployerAgentIndex === 0 && deployerAddress) {
    await User.updateOne(
      { address: deployerAddress.toLowerCase() },
      { $inc: { totalTokensLaunched: 1 } },
    );
  }

  res.status(201).json({ id: token._id, tokenAddress: token.tokenAddress, success: true });
});

// ─── GET /api/tokens ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);
  const { agentIndex, sessionId, chain } = req.query;

  const filter: Record<string, unknown> = {};
  if (agentIndex !== undefined) filter.deployerAgentIndex = parseInt(agentIndex as string);
  if (sessionId) filter.sessionId = sessionId;
  if (chain) filter.chain = chain;

  const [tokens, total] = await Promise.all([
    TokenLaunch.find(filter).sort({ deployedAt: -1 }).skip(page * limit).limit(limit).lean(),
    TokenLaunch.countDocuments(filter),
  ]);

  res.json({ tokens, total, page, limit });
});

// ─── GET /api/tokens/:address ─────────────────────────────────────────────────
router.get('/:address', async (req: Request, res: Response) => {
  const tokenAddress = req.params.address.toLowerCase();
  const token = await TokenLaunch.findOne({ tokenAddress }).lean();

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }
  res.json(token);
});

// ─── PATCH /api/tokens/:address/fees ─────────────────────────────────────────
router.patch('/:address/fees', requireAuth, async (req: Request, res: Response) => {
  const tokenAddress = req.params.address.toLowerCase();
  const { feesClaimed } = req.body;

  if (typeof feesClaimed !== 'number' || feesClaimed <= 0) {
    res.status(400).json({ error: 'feesClaimed must be a positive number' });
    return;
  }

  const token = await TokenLaunch.findOneAndUpdate(
    { tokenAddress },
    {
      $inc: { totalFeesClaimed: feesClaimed },
      $set: { lastFeeClaimAt: new Date() },
    },
    { new: true },
  );

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({ totalFeesClaimed: token.totalFeesClaimed, success: true });
});

export default router;
