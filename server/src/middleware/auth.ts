import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  address: string;
  iat?: number;
  exp?: number;
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
