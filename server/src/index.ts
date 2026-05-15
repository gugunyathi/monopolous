import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import agentsRoutes from './routes/agents';
import tradesRoutes from './routes/trades';
import tokensRoutes from './routes/tokens';
import socialRoutes from './routes/social';
import gameRoutes from './routes/game';
import notificationsRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
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

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), version: '1.0.0' });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

let startupPromise: Promise<void> | null = null;

export async function ensureServerReady(): Promise<void> {
  if (!startupPromise) {
    startupPromise = connectDB().catch((error) => {
      startupPromise = null;
      throw error;
    });
  }

  await startupPromise;
}

export default app;

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await ensureServerReady();
    app.listen(PORT, () => {
      console.log(`[Monopolous API] Running on port ${PORT}`);
      console.log(`[Monopolous API] CORS allowed origins: ${allowedOrigins.join(', ')}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

if (process.env.VERCEL !== '1') {
  start();
}
