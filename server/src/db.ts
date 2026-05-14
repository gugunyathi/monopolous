import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? '';

export async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('[DB] MONGODB_URI environment variable is not set');
  }

  mongoose.connection.on('connected', () => console.log('[DB] MongoDB connected'));
  mongoose.connection.on('disconnected', () => console.log('[DB] MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error('[DB] MongoDB error:', err));

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}

export { mongoose };
