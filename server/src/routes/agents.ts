import { Router, Request, Response } from 'express';
import { AgentState } from '../models/AgentState.js';
import { Trade } from '../models/Trade.js';
import { TokenLaunch } from '../models/TokenLaunch.js';
import { AgentProfile } from '../models/AgentProfile.js';
import { AgentChat } from '../models/AgentChat.js';
import { AgentSession } from '../models/AgentSession.js';
import { requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore } from '../services/memoryStore.js';

const router = Router();

// ─── GET /api/agents ──────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  if (isDBConnected()) {
    try {
      const agents = await AgentState.find()
        .sort({ currentNetWorth: -1 })
        .limit(100)
        .lean();
      if (agents.length > 0) {
        res.json({ agents, count: agents.length });
        return;
      }
    } catch {}
  }

  const agents = Array.from(memoryStore.agentStates.values()).sort((a, b) => b.currentNetWorth - a.currentNetWorth);
  res.json({ agents, count: agents.length });
});

// ─── GET /api/agents/:index ───────────────────────────────────────────────────
router.get('/:index', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);

  if (isNaN(agentIndex) || agentIndex < 0 || agentIndex > 1999) {
    res.status(400).json({ error: 'Invalid agent index (0-1999)' });
    return;
  }

  if (isDBConnected()) {
    try {
      const agent = await AgentState.findOne({ agentIndex }).lean();
      if (agent) {
        const recentTrades = await Trade.find({ agentIndex })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean();

        const tokens = await TokenLaunch.find({ deployerAgentIndex: agentIndex })
          .sort({ deployedAt: -1 })
          .limit(10)
          .lean();

        res.json({ agent, recentTrades, tokens });
        return;
      }
    } catch {}
  }

  const agent = memoryStore.agentStates.get(agentIndex) ?? {
    agentIndex,
    currentBalance: 1500,
    peakBalance: 1500,
    propertiesOwned: [],
    currentTileIndex: 0,
    isInJail: false,
    totalTradesCount: 0,
    totalTokensLaunched: 0,
    isADKActive: true,
    currentRank: agentIndex + 1,
    currentNetWorth: 1500,
    lastActiveAt: new Date(),
  };

  const recentTrades = memoryStore.trades.filter((t) => t.agentIndex === agentIndex).slice(0, 10);
  const tokens = memoryStore.tokens.filter((t) => t.deployerAgentIndex === agentIndex).slice(0, 10);

  res.json({ agent, recentTrades, tokens });
});

// ─── POST /api/agents/state/batch ────────────────────────────────────────────
router.post('/state/batch', requireAuth, async (req: Request, res: Response) => {
  const { states } = req.body;

  if (!Array.isArray(states) || states.length === 0) {
    res.status(400).json({ error: 'states array is required' });
    return;
  }

  if (states.length > 100) {
    res.status(400).json({ error: 'Maximum 100 agent states per batch' });
    return;
  }

  // Update memory store
  for (const s of states) {
    if (typeof s.agentIndex === 'number') {
      const existing = memoryStore.agentStates.get(s.agentIndex) || {
        agentIndex: s.agentIndex,
        currentBalance: 1500,
        peakBalance: 1500,
        propertiesOwned: [],
        currentTileIndex: 0,
        isInJail: false,
        totalTradesCount: 0,
        totalTokensLaunched: 0,
        isADKActive: true,
        currentRank: s.agentIndex + 1,
        currentNetWorth: 1500,
        lastActiveAt: new Date(),
      };
      Object.assign(existing, s, { lastActiveAt: new Date() });
      memoryStore.agentStates.set(s.agentIndex, existing);
    }
  }

  if (isDBConnected()) {
    try {
      const ops = states.map((s: Record<string, unknown>) => ({
        updateOne: {
          filter: { agentIndex: s.agentIndex },
          update: {
            $set: {
              sessionId: s.sessionId,
              currentBalance: s.currentBalance,
              peakBalance: s.peakBalance,
              propertiesOwned: s.propertiesOwned,
              currentTileIndex: s.currentTileIndex,
              isInJail: s.isInJail,
              totalTradesCount: s.totalTradesCount,
              totalTokensLaunched: s.totalTokensLaunched,
              isADKActive: s.isADKActive,
              currentRank: s.currentRank,
              currentNetWorth: s.currentNetWorth,
              lastActiveAt: new Date(),
            },
          } as Record<string, unknown>,
          upsert: true,
        },
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await AgentState.bulkWrite(ops as any);
    } catch {}
  }

  res.json({ success: true, updated: states.length });
});

// ─── PATCH /api/agents/:index ─────────────────────────────────────────────────
router.patch('/:index', requireAuth, async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);

  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  const allowed = [
    'currentBalance', 'peakBalance', 'propertiesOwned', 'currentTileIndex',
    'isInJail', 'jailTurnsRemaining', 'totalTradesCount', 'totalTokensLaunched',
    'totalPolymarketBets', 'totalX402Payments', 'totalRentCollected', 'totalRentPaid',
    'isADKActive', 'adkActionsCount', 'currentRank', 'currentNetWorth',
    'bnkrWalletId', 'bnkrMasterAddress', 'allocatedBalance',
  ];

  const updates: Record<string, unknown> = { lastActiveAt: new Date() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const existing = memoryStore.agentStates.get(agentIndex) || {
    agentIndex,
    currentBalance: 1500,
    peakBalance: 1500,
    propertiesOwned: [],
    currentTileIndex: 0,
    isInJail: false,
    totalTradesCount: 0,
    totalTokensLaunched: 0,
    isADKActive: true,
    currentRank: agentIndex + 1,
    currentNetWorth: 1500,
    lastActiveAt: new Date(),
  };
  Object.assign(existing, updates);
  memoryStore.agentStates.set(agentIndex, existing);

  if (isDBConnected()) {
    try {
      await AgentState.updateOne({ agentIndex }, { $set: updates }, { upsert: true });
    } catch {}
  }

  res.json({ success: true });
});

// ─── GET /api/agents/:index/trades ───────────────────────────────────────────
router.get('/:index/trades', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = Math.max(parseInt(req.query.page as string) || 0, 0);

  if (isDBConnected()) {
    try {
      const trades = await Trade.find({ agentIndex })
        .sort({ timestamp: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean();

      const total = await Trade.countDocuments({ agentIndex });
      res.json({ trades, total, page, limit });
      return;
    } catch {}
  }

  const allTrades = memoryStore.trades.filter((t) => t.agentIndex === agentIndex);
  const trades = allTrades.slice(page * limit, (page + 1) * limit);
  res.json({ trades, total: allTrades.length, page, limit });
});

// ─── GET /api/agents/:index/profile ──────────────────────────────────────────
router.get('/:index/profile', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  if (isDBConnected()) {
    try {
      const profile = await AgentProfile.findOne({ agentIndex }).lean();
      if (profile) {
        res.json({ profile });
        return;
      }
    } catch {}
  }

  const profile = memoryStore.agentProfiles.get(agentIndex) || {
    agentIndex,
    name: `Agent #${agentIndex}`,
    role: 'Autonomous Agent',
    status: 'active',
    updatedAt: new Date(),
  };

  res.json({ profile });
});

// ─── PUT /api/agents/:index/profile ──────────────────────────────────────────
router.put('/:index/profile', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  const { name, role, walletAddress, bnkrWalletId, avatarUrl, personality, strategy, bio, traits, skills, status } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (walletAddress !== undefined) updates.walletAddress = walletAddress;
  if (bnkrWalletId !== undefined) updates.bnkrWalletId = bnkrWalletId;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (personality !== undefined) updates.personality = personality;
  if (strategy !== undefined) updates.strategy = strategy;
  if (bio !== undefined) updates.bio = bio;
  if (traits !== undefined) updates.traits = traits;
  if (skills !== undefined) updates.skills = skills;
  if (status !== undefined) updates.status = status;

  memoryStore.agentProfiles.set(agentIndex, {
    agentIndex,
    name: name || `Agent #${agentIndex}`,
    role: role || 'Autonomous Agent',
    walletAddress,
    bnkrWalletId,
    avatarUrl,
    personality,
    strategy,
    bio,
    status: status || 'active',
    updatedAt: new Date(),
  });

  if (isDBConnected()) {
    try {
      const updated = await AgentProfile.findOneAndUpdate(
        { agentIndex },
        { $set: updates },
        { new: true, upsert: true }
      ).lean();
      res.json({ profile: updated });
      return;
    } catch {}
  }

  res.json({ profile: memoryStore.agentProfiles.get(agentIndex) });
});

// ─── GET /api/agents/:index/chat ──────────────────────────────────────────────
router.get('/:index/chat', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const sessionId = (req.query.sessionId as string) || 'default_session';

  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  if (isDBConnected()) {
    try {
      const chatDoc = await AgentChat.findOne({ agentIndex, sessionId }).lean();
      if (chatDoc) {
        res.json({ messages: chatDoc.messages, sessionId: chatDoc.sessionId });
        return;
      }
    } catch {}
  }

  const key = `${agentIndex}_${sessionId}`;
  const memoryChat = memoryStore.agentChats.get(key);
  res.json({ messages: memoryChat?.messages || [], sessionId });
});

// ─── POST /api/agents/:index/chat ─────────────────────────────────────────────
router.post('/:index/chat', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const { message, sessionId = 'default_session', walletAddress, userAddress } = req.body;

  if (isNaN(agentIndex) || agentIndex < 0 || !message || typeof message.text !== 'string') {
    res.status(400).json({ error: 'Valid agent index and message text are required' });
    return;
  }

  const chatMessage = {
    role: message.role === 'user' ? ('user' as const) : ('agent' as const),
    text: message.text,
    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    metadata: message.metadata || {},
  };

  const key = `${agentIndex}_${sessionId}`;
  let existingMemChat = memoryStore.agentChats.get(key);
  if (!existingMemChat) {
    existingMemChat = {
      agentIndex,
      sessionId,
      userAddress,
      messages: [],
      lastMessageAt: new Date(),
    };
    memoryStore.agentChats.set(key, existingMemChat);
  }
  existingMemChat.messages.push(chatMessage);
  existingMemChat.lastMessageAt = new Date();

  if (isDBConnected()) {
    try {
      const updatedChat = await AgentChat.findOneAndUpdate(
        { agentIndex, sessionId },
        {
          $push: { messages: chatMessage },
          $set: {
            walletAddress: walletAddress || null,
            userAddress: userAddress || null,
            lastMessageAt: new Date(),
          },
        },
        { new: true, upsert: true }
      ).lean();
      res.json({ success: true, messages: updatedChat?.messages || existingMemChat.messages });
      return;
    } catch {}
  }

  res.json({ success: true, messages: existingMemChat.messages });
});

// ─── GET /api/agents/:index/sessions ──────────────────────────────────────────
router.get('/:index/sessions', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  if (isDBConnected()) {
    try {
      const sessions = await AgentSession.find({ agentIndex })
        .sort({ startedAt: -1 })
        .limit(50)
        .lean();
      res.json({ sessions });
      return;
    } catch {}
  }

  res.json({ sessions: [] });
});

// ─── POST /api/agents/:index/sessions ─────────────────────────────────────────
router.post('/:index/sessions', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  const { sessionId, walletAddress, userAddress, status = 'active', initialBalance = 1500 } = req.body;

  if (isNaN(agentIndex) || agentIndex < 0 || !sessionId) {
    res.status(400).json({ error: 'Valid agent index and sessionId are required' });
    return;
  }

  if (isDBConnected()) {
    try {
      const session = await AgentSession.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            agentIndex,
            walletAddress: walletAddress || null,
            userAddress: userAddress || null,
            status,
            initialBalance,
          },
        },
        { new: true, upsert: true }
      ).lean();
      res.json({ success: true, session });
      return;
    } catch {}
  }

  res.json({ success: true, sessionId });
});

// ─── GET /api/agents/:index/history ───────────────────────────────────────────
router.get('/:index/history', async (req: Request, res: Response) => {
  const agentIndex = parseInt(req.params.index);
  if (isNaN(agentIndex) || agentIndex < 0) {
    res.status(400).json({ error: 'Invalid agent index' });
    return;
  }

  let trades: any[] = [];
  let tokens: any[] = [];
  let chats: any[] = [];
  let sessions: any[] = [];

  if (isDBConnected()) {
    try {
      [trades, tokens, chats, sessions] = await Promise.all([
        Trade.find({ agentIndex }).sort({ timestamp: -1 }).limit(50).lean(),
        TokenLaunch.find({ deployerAgentIndex: agentIndex }).sort({ deployedAt: -1 }).limit(20).lean(),
        AgentChat.find({ agentIndex }).sort({ lastMessageAt: -1 }).limit(10).lean(),
        AgentSession.find({ agentIndex }).sort({ startedAt: -1 }).limit(10).lean(),
      ]);
    } catch {}
  } else {
    trades = memoryStore.trades.filter((t) => t.agentIndex === agentIndex).slice(0, 50);
    tokens = memoryStore.tokens.filter((t) => t.deployerAgentIndex === agentIndex).slice(0, 20);
    chats = Array.from(memoryStore.agentChats.values()).filter((c) => c.agentIndex === agentIndex);
  }

  res.json({
    agentIndex,
    trades,
    tokens,
    chats,
    sessions,
    totalTrades: trades.length,
    totalTokens: tokens.length,
  });
});

export default router;
