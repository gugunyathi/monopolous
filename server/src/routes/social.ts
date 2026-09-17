import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { SocialPost } from '../models/SocialPost.js';
import { isDBConnected } from '../db.js';
import { memoryStore, type InMemorySocialPost } from '../services/memoryStore.js';

interface SocialPostBody {
  id: string;
  agentIndex: number;
  sessionId: string;
  type: string;
  content: string;
  token?: string;
  action?: string;
  likes: number;
  timestamp: number;
  postCategory?: string;
  isADK?: boolean;
  polymarket?: Record<string, unknown>;
}

const router = Router();

// ─── POST /api/social/posts ───────────────────────────────────────────────────
router.post('/posts', requireAuth, async (req: Request, res: Response) => {
  const post: SocialPostBody = req.body;

  if (!post.id || post.agentIndex === undefined || !post.content || !post.sessionId) {
    res.status(400).json({ error: 'Missing required fields: id, agentIndex, content, sessionId' });
    return;
  }

  const doc: InMemorySocialPost = {
    id: post.id,
    agentIndex: post.agentIndex,
    sessionId: post.sessionId,
    type: post.type ?? 'post',
    content: post.content.slice(0, 2000),
    token: post.token,
    action: post.action,
    likes: post.likes ?? 0,
    timestamp: post.timestamp ?? Date.now(),
    postCategory: post.postCategory,
    isADK: post.isADK ?? false,
    polymarket: post.polymarket,
  };

  const existingIdx = memoryStore.socialPosts.findIndex((p) => p.id === doc.id);
  if (existingIdx >= 0) {
    memoryStore.socialPosts[existingIdx] = doc;
  } else {
    memoryStore.socialPosts.unshift(doc);
  }

  if (isDBConnected()) {
    try {
      await SocialPost.findOneAndUpdate(
        { id: doc.id },
        doc,
        { upsert: true, new: true },
      );
    } catch {}
  }

  res.status(201).json({ success: true });
});

// ─── POST /api/social/posts/batch ────────────────────────────────────────────
router.post('/posts/batch', requireAuth, async (req: Request, res: Response) => {
  const { posts } = req.body;

  if (!Array.isArray(posts) || posts.length === 0) {
    res.status(400).json({ error: 'posts array is required' });
    return;
  }

  if (posts.length > 100) {
    res.status(400).json({ error: 'Max 100 posts per batch' });
    return;
  }

  for (const p of posts) {
    const doc: InMemorySocialPost = {
      id: p.id,
      agentIndex: p.agentIndex,
      sessionId: p.sessionId,
      type: p.type ?? 'post',
      content: (p.content ?? '').slice(0, 2000),
      token: p.token,
      action: p.action,
      likes: p.likes ?? 0,
      timestamp: p.timestamp ?? Date.now(),
      postCategory: p.postCategory,
      isADK: p.isADK ?? false,
    };
    const existingIdx = memoryStore.socialPosts.findIndex((item) => item.id === doc.id);
    if (existingIdx >= 0) {
      memoryStore.socialPosts[existingIdx] = doc;
    } else {
      memoryStore.socialPosts.unshift(doc);
    }
  }

  if (isDBConnected()) {
    try {
      const ops = posts.map((p: SocialPostBody) => ({
        updateOne: {
          filter: { id: p.id },
          update: {
            id: p.id,
            agentIndex: p.agentIndex,
            sessionId: p.sessionId,
            type: p.type ?? 'post',
            content: (p.content ?? '').slice(0, 2000),
            token: p.token,
            action: p.action,
            likes: p.likes ?? 0,
            timestamp: p.timestamp ?? Date.now(),
            postCategory: p.postCategory,
            isADK: p.isADK ?? false,
          },
          upsert: true,
        },
      }));

      await SocialPost.bulkWrite(ops);
    } catch {}
  }

  res.json({ success: true, saved: posts.length });
});

// ─── GET /api/social/posts ────────────────────────────────────────────────────
router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const before = req.query.before ? parseInt(req.query.before as string) : Date.now();
  const { agentIndex, sessionId, type, postCategory } = req.query;

  if (isDBConnected()) {
    try {
      const filter: Record<string, unknown> = { timestamp: { $lt: before } };
      if (agentIndex !== undefined) filter.agentIndex = parseInt(agentIndex as string);
      if (sessionId) filter.sessionId = sessionId;
      if (type) filter.type = type;
      if (postCategory) filter.postCategory = postCategory;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = await SocialPost.find(filter as any)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      if (posts.length > 0) {
        res.json({ posts, count: posts.length });
        return;
      }
    } catch {}
  }

  let filtered = memoryStore.socialPosts.filter((p) => p.timestamp < before);
  if (agentIndex !== undefined) {
    const idx = parseInt(agentIndex as string);
    filtered = filtered.filter((p) => p.agentIndex === idx);
  }
  if (sessionId) {
    filtered = filtered.filter((p) => p.sessionId === sessionId);
  }
  if (type) {
    filtered = filtered.filter((p) => p.type === type);
  }
  if (postCategory) {
    filtered = filtered.filter((p) => p.postCategory === postCategory);
  }

  const posts = filtered.slice(0, limit);
  res.json({ posts, count: posts.length });
});

// ─── PATCH /api/social/posts/:id/like ────────────────────────────────────────
router.patch('/posts/:id/like', optionalAuth, async (req: Request, res: Response) => {
  const post = memoryStore.socialPosts.find((p) => p.id === req.params.id);
  if (post) {
    post.likes = (post.likes || 0) + 1;
  }

  if (isDBConnected()) {
    try {
      const dbPost = await SocialPost.findOneAndUpdate(
        { id: req.params.id },
        { $inc: { likes: 1 } },
        { new: true },
      );
      if (dbPost) {
        res.json({ likes: dbPost.likes });
        return;
      }
    } catch {}
  }

  if (!post) {
    res.json({ likes: 1 });
    return;
  }

  res.json({ likes: post.likes });
});

export default router;
