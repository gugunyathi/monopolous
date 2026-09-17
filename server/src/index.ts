import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import agentsRoutes from './routes/agents.js';
import tradesRoutes from './routes/trades.js';
import tokensRoutes from './routes/tokens.js';
import socialRoutes from './routes/social.js';
import gameRoutes from './routes/game.js';
import notificationsRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import arcRoutes from './routes/arc.js';
import { startArcAutonomyScheduler, stopArcAutonomyScheduler } from './services/arcAutonomyService.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please wait.' },
});

app.use('/api/', globalLimiter);

// ─── Body Parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/arc', arcRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
});

// ─── 404 Handler for API routes ─────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isDbError =
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerError' ||
    err.name === 'MongoDriverError' ||
    err.name === 'MongoNotConnectedError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.message?.includes('buffering timed out') ||
    err.message?.includes('Client must be connected') ||
    err.message?.includes('authentication failed') ||
    err.message?.includes('bad auth') ||
    err.message?.includes('topology was destroyed') ||
    err.message?.includes('ECONNREFUSED');

  if (isDbError) {
    console.warn('[DB Fallback] Request handled in offline mode:', req.method, req.path);
    if (req.method === 'GET') {
      if (req.path.endsWith('s') || req.path.endsWith('s/')) {
        return res.json([]);
      }
      return res.json({ success: true, offline: true });
    }
    return res.status(200).json({ success: true, offline: true, simulated: true });
  }

  console.error('[Server Error]', err.name, err.message);
  res.status(500).json({ error: 'Internal server error' });
});

let startupPromise: Promise<void> | null = null;

export async function ensureServerReady(): Promise<void> {
  if (!startupPromise) {
    startupPromise = connectDB().catch((error) => {
      console.warn('[Server] connectDB notice:', error?.message || error);
    });
  }

  await startupPromise;
}

export default app;

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await ensureServerReady();
    try {
      startArcAutonomyScheduler();
    } catch (e) {
      console.warn('[Server] Arc scheduler failed to start:', e);
    }
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Monopolous API] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
  }
}

if (process.env.STANDALONE_SERVER === '1') {
  start();
}


process.on('SIGINT', () => {
  stopArcAutonomyScheduler();
});

process.on('SIGTERM', () => {
  stopArcAutonomyScheduler();
});
