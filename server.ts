import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app, { ensureServerReady } from './server/src/index.js';
import { startArcAutonomyScheduler } from './server/src/services/arcAutonomyService.js';

async function startServer() {
  const PORT = 3000;

  // Launch background services asynchronously without blocking server start
  ensureServerReady().then(() => {
    try {
      startArcAutonomyScheduler();
    } catch (err) {
      console.warn('[Server] Arc scheduler warning:', err);
    }
  }).catch((err) => {
    console.warn('[Server] Background init warning:', err?.message || err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Monopolous Server] Running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Monopolous Server] Port ${PORT} is already in use.`);
    } else {
      console.error('[Monopolous Server] Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
