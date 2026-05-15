import { Router, Request, Response } from 'express';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { parseSiweMessage } from 'viem/siwe';
import { v4 as uuidv4 } from 'uuid';
import { Nonce } from '../models/Nonce';
import { User } from '../models/User';
import { signToken, requireAuth } from '../middleware/auth';

const viemClient = createPublicClient({ chain: base, transport: http() });

const router = Router();

// ─── GET /api/auth/nonce ─────────────────────────────────────────────────────
// Request a sign-in challenge for the given wallet address.
router.post('/nonce', async (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Ethereum address' });
    return;
  }

  const nonce = uuidv4().replace(/-/g, '').slice(0, 32);
  await Nonce.findOneAndUpdate(
    { address: address.toLowerCase() },
    { address: address.toLowerCase(), nonce, createdAt: new Date() },
    { upsert: true, new: true },
  );

  res.json({ nonce });
});

// ─── POST /api/auth/verify ───────────────────────────────────────────────────
// Verify signed SIWE message, create/update user, return JWT.
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

  // Parse the SIWE message to extract nonce
  let parsedNonce: string;
  try {
    const parsed = parseSiweMessage(message);
    parsedNonce = parsed.nonce;
  } catch {
    res.status(400).json({ error: 'Invalid SIWE message format' });
    return;
  }

  // Check nonce exists and belongs to this address
  const nonceDoc = await Nonce.findOne({ address: address.toLowerCase(), nonce: parsedNonce });
  if (!nonceDoc) {
    res.status(401).json({ error: 'Nonce not found or expired. Request a new nonce.' });
    return;
  }

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
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Delete used nonce (single-use)
  await Nonce.deleteOne({ _id: nonceDoc._id });

  // Upsert user record
  const user = await User.findOneAndUpdate(
    { address: address.toLowerCase() },
    {
      $setOnInsert: { firstLoginAt: new Date() },
      $set: { lastActiveAt: new Date() },
      $inc: { totalGamesPlayed: 1 },
    },
    { upsert: true, new: true },
  );

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
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Return current user profile from JWT.
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const address = req.auth!.address;
  const user = await User.findOne({ address });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

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
});

export default router;
