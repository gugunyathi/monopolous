import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  address: string;
  iat?: number;
  exp?: number;
}

function getArcWorkerToken(): string {
  const token = process.env.ARC_WORKER_TOKEN;
  if (!token) {
    throw new Error('ARC_WORKER_TOKEN environment variable is not set');
  }
  return token;
}

// Extend Express Request to carry the decoded auth payload
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

/**
 * Strict middleware — rejects requests without a valid JWT.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function getAdminWalletAddress(): string | null {
  const admin = process.env.ADMIN_WALLET_ADDRESS ?? process.env.VITE_ADMIN_WALLET_ADDRESS;
  if (!admin) return null;
  return admin.toLowerCase();
}

/**
 * Strict admin middleware — requires valid JWT and admin wallet ownership.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const configuredAdmin = getAdminWalletAddress();
    if (!configuredAdmin) {
      res.status(503).json({ error: 'ADMIN_WALLET_ADDRESS is not configured on the server' });
      return;
    }

    const caller = req.auth?.address?.toLowerCase();
    if (!caller || caller !== configuredAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  });
}

/**
 * Internal worker middleware for ARC autonomy tick endpoints.
 * Uses a shared token and is intended for private service-to-service calls.
 */
export function requireArcWorker(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.headers['x-arc-worker-token'];
  const provided = typeof headerToken === 'string' ? headerToken : '';

  try {
    const expected = getArcWorkerToken();
    if (!provided || provided !== expected) {
      res.status(401).json({ error: 'Invalid ARC worker token' });
      return;
    }
    next();
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'ARC worker auth unavailable' });
  }
}

/**
 * Optional middleware — attaches auth payload if JWT is present but doesn't reject.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      req.auth = jwt.verify(token, getJwtSecret()) as AuthPayload;
    } catch {
      // Ignore invalid token in optional mode
    }
  }
  next();
}

export function signToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, getJwtSecret(), { expiresIn: '7d' });
}
