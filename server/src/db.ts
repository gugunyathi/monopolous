import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? '';
let connectionPromise: Promise<void> | null = null;
let listenersAttached = false;

export async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('[DB] MONGODB_URI environment variable is not set');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!listenersAttached) {
    mongoose.connection.on('connected', () => console.log('[DB] MongoDB connected'));
    mongoose.connection.on('disconnected', () => console.log('[DB] MongoDB disconnected'));
    mongoose.connection.on('error', (err) => console.error('[DB] MongoDB error:', err));
    listenersAttached = true;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    }).then(() => undefined)
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

export { mongoose };
