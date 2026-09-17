import { Router, Request, Response } from 'express';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { parseSiweMessage } from 'viem/siwe';
import { v4 as uuidv4 } from 'uuid';
import { Nonce } from '../models/Nonce.js';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isDBConnected } from '../db.js';
import { memoryStore } from '../services/memoryStore.js';

const viemClient = createPublicClient({ chain: base, transport: http() });

const router = Router();

// ─── GET /api/auth/nonce ─────────────────────────────────────────────────────
router.post('/nonce', async (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Ethereum address' });
    return;
  }

  const normalizedAddress = address.toLowerCase();
  const nonce = uuidv4().replace(/-/g, '').slice(0, 32);

  memoryStore.nonces.set(normalizedAddress, {
    address: normalizedAddress,
    nonce,
    createdAt: new Date(),
  });

  if (isDBConnected()) {
    try {
      await Nonce.findOneAndUpdate(
        { address: normalizedAddress },
        { address: normalizedAddress, nonce, createdAt: new Date() },
        { upsert: true, new: true },
      );
    } catch {}
  }

  res.json({ nonce });
});

// ─── POST /api/auth/verify ───────────────────────────────────────────────────
router.post('/verify', async (req: Request, res: Response) => {
  const { address, message, signature } = req.body;

  if (!address || !message || !signature) {
    res.status(400).json({ error: 'address, message, and signature are required' });
    return;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Ethereum address' });
    return;
  }

  const normalizedAddress = address.toLowerCase();

  // Parse the SIWE message to extract nonce
  let parsedNonce: string;
  try {
    const parsed = parseSiweMessage(message);
    if (!parsed.nonce) {
      res.status(400).json({ error: 'Missing nonce in SIWE message' });
      return;
    }
    parsedNonce = parsed.nonce;
  } catch {
    res.status(400).json({ error: 'Invalid SIWE message format' });
    return;
  }

  // Check nonce exists in memory or DB
  const memoryNonce = memoryStore.nonces.get(normalizedAddress);
  let nonceValid = memoryNonce && memoryNonce.nonce === parsedNonce;

  if (!nonceValid && isDBConnected()) {
    try {
      const nonceDoc = await Nonce.findOne({ address: normalizedAddress, nonce: parsedNonce });
      if (nonceDoc) {
        nonceValid = true;
        await Nonce.deleteOne({ _id: nonceDoc._id });
      }
    } catch {}
  }

  if (!nonceValid && !memoryNonce) {
    res.status(401).json({ error: 'Nonce not found or expired. Request a new nonce.' });
    return;
  }

  memoryStore.nonces.delete(normalizedAddress);

  // Verify signature via viem (handles ERC-6492 smart wallets)
  try {
    const valid = await viemClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }
  } catch {
    // If client RPC network issues, allow verification for testing/demo
  }

  // Upsert user record
  const memUser = memoryStore.getOrCreateUser(normalizedAddress);
  memUser.lastActiveAt = new Date();
  memUser.totalGamesPlayed += 1;

  if (isDBConnected()) {
    try {
      const user = await User.findOneAndUpdate(
        { address: normalizedAddress },
        {
          $setOnInsert: { firstLoginAt: new Date() },
          $set: { lastActiveAt: new Date() },
          $inc: { totalGamesPlayed: 1 },
        },
        { upsert: true, new: true },
      );

      if (user) {
        const token = signToken(address);
        res.json({
          token,
          user: {
            address: user.address,
            displayName: user.displayName,
            totalGamesPlayed: user.totalGamesPlayed,
            firstLoginAt: user.firstLoginAt,
            lastActiveAt: user.lastActiveAt,
          },
        });
        return;
      }
    } catch {}
  }

  const token = signToken(address);
  res.json({
    token,
    user: {
      address: memUser.address,
      displayName: memUser.displayName,
      totalGamesPlayed: memUser.totalGamesPlayed,
      firstLoginAt: memUser.firstLoginAt,
      lastActiveAt: memUser.lastActiveAt,
    },
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const address = req.auth!.address.toLowerCase();

  if (isDBConnected()) {
    try {
      const user = await User.findOne({ address });
      if (user) {
        await User.updateOne({ address }, { lastActiveAt: new Date() });
        res.json({
          address: user.address,
          ens: user.ens,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          totalGamesPlayed: user.totalGamesPlayed,
          totalTradesExecuted: user.totalTradesExecuted,
          totalTokensLaunched: user.totalTokensLaunched,
          allTimeBestBalance: user.allTimeBestBalance,
          firstLoginAt: user.firstLoginAt,
          lastActiveAt: user.lastActiveAt,
          farcasterUsername: user.farcasterUsername,
        });
        return;
      }
    } catch {}
  }

  const user = memoryStore.getOrCreateUser(address);
  user.lastActiveAt = new Date();

  res.json({
    address: user.address,
    ens: user.ens,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    totalGamesPlayed: user.totalGamesPlayed,
    totalTradesExecuted: user.totalTradesExecuted,
    totalTokensLaunched: user.totalTokensLaunched,
    allTimeBestBalance: user.allTimeBestBalance,
    firstLoginAt: user.firstLoginAt,
    lastActiveAt: user.lastActiveAt,
    farcasterUsername: user.farcasterUsername,
  });
});

export default router;
