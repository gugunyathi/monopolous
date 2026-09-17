import { Router, Request, Response } from 'express';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { AgentState } from '../models/AgentState.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore, type InMemoryTokenLaunch } from '../services/memoryStore.js';
import { v4 as uuidv4 } from 'uuid';

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

  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    res.status(400).json({ error: 'Invalid token address format' });
    return;
  }

  const tokenId = uuidv4();
  const memToken: InMemoryTokenLaunch = {
    _id: tokenId,
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
  };

  memoryStore.tokens.unshift(memToken);

  const agent = memoryStore.agentStates.get(deployerAgentIndex);
  if (agent) {
    agent.totalTokensLaunched += 1;
    agent.lastActiveAt = new Date();
  }

  if (deployerAgentIndex === 0 && deployerAddress) {
    const user = memoryStore.getOrCreateUser(deployerAddress);
    user.totalTokensLaunched += 1;
  }

  if (isDBConnected()) {
    try {
      const token = await TokenLaunch.create(memToken);

      await AgentState.updateOne(
        { agentIndex: deployerAgentIndex },
        { $inc: { totalTokensLaunched: 1 }, $set: { lastActiveAt: new Date() } },
        { upsert: true },
      );

      if (deployerAgentIndex === 0 && deployerAddress) {
        await User.updateOne(
          { address: deployerAddress.toLowerCase() },
          { $inc: { totalTokensLaunched: 1 } },
        );
      }

      res.status(201).json({ id: token._id, tokenAddress: token.tokenAddress, success: true });
      return;
    } catch {}
  }

  res.status(201).json({ id: tokenId, tokenAddress: memToken.tokenAddress, success: true });
});

// ─── GET /api/tokens ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);
  const { agentIndex, sessionId, chain } = req.query;

  if (isDBConnected()) {
    try {
      const filter: Record<string, unknown> = {};
      if (agentIndex !== undefined) filter.deployerAgentIndex = parseInt(agentIndex as string);
      if (sessionId) filter.sessionId = sessionId;
      if (chain) filter.chain = chain;

      const [tokens, total] = await Promise.all([
        TokenLaunch.find(filter).sort({ deployedAt: -1 }).skip(page * limit).limit(limit).lean(),
        TokenLaunch.countDocuments(filter),
      ]);

      if (tokens.length > 0 || total > 0) {
        res.json({ tokens, total, page, limit });
        return;
      }
    } catch {}
  }

  let filtered = [...memoryStore.tokens];
  if (agentIndex !== undefined) {
    const idx = parseInt(agentIndex as string);
    filtered = filtered.filter((t) => t.deployerAgentIndex === idx);
  }
  if (sessionId) filtered = filtered.filter((t) => t.sessionId === sessionId);
  if (chain) filtered = filtered.filter((t) => t.chain === chain);

  const tokens = filtered.slice(page * limit, (page + 1) * limit);
  res.json({ tokens, total: filtered.length, page, limit });
});

// ─── GET /api/tokens/:address ─────────────────────────────────────────────────
router.get('/:address', async (req: Request, res: Response) => {
  const tokenAddress = req.params.address.toLowerCase();

  if (isDBConnected()) {
    try {
      const token = await TokenLaunch.findOne({ tokenAddress }).lean();
      if (token) {
        res.json(token);
        return;
      }
    } catch {}
  }

  const token = memoryStore.tokens.find((t) => t.tokenAddress === tokenAddress);
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

  const token = memoryStore.tokens.find((t) => t.tokenAddress === tokenAddress);
  if (token) {
    token.totalFeesClaimed = (token.totalFeesClaimed || 0) + feesClaimed;
    token.lastFeeClaimAt = new Date();
  }

  if (isDBConnected()) {
    try {
      const dbToken = await TokenLaunch.findOneAndUpdate(
        { tokenAddress },
        {
          $inc: { totalFeesClaimed: feesClaimed },
          $set: { lastFeeClaimAt: new Date() },
        },
        { new: true },
      );
      if (dbToken) {
        res.json({ totalFeesClaimed: dbToken.totalFeesClaimed, success: true });
        return;
      }
    } catch {}
  }

  if (!token) {
    res.status(404).json({ error: 'Token not found' });
    return;
  }

  res.json({ totalFeesClaimed: token.totalFeesClaimed, success: true });
});

export default router;
