import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

const RAW_MONGODB_URI = process.env.MONGODB_URI?.trim() ?? '';

function isValidMongoUri(uri: string): boolean {
  if (!uri) return false;
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) return false;
  if (uri.includes('<password>') || uri.includes('<username>') || uri.includes('YOUR_')) return false;
  return true;
}

const MONGODB_URI = isValidMongoUri(RAW_MONGODB_URI) ? RAW_MONGODB_URI : '';
let isOfflineMode = !MONGODB_URI;
let listenersAttached = false;
let isConnecting = false;

export function isDBConnected(): boolean {
  return !isOfflineMode && mongoose.connection.readyState === 1;
}

export function isDBOffline(): boolean {
  return isOfflineMode || mongoose.connection.readyState !== 1;
}

export async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    isOfflineMode = true;
    return;
  }

  if (isOfflineMode || isConnecting || mongoose.connection.readyState === 1) {
    return;
  }

  if (!listenersAttached) {
    mongoose.connection.on('connected', () => {
      isOfflineMode = false;
      console.log('[DB] MongoDB connected successfully');
    });
    mongoose.connection.on('disconnected', () => {
      // Offline fallback
    });
    mongoose.connection.on('error', () => {
      isOfflineMode = true;
    });
    listenersAttached = true;
  }

  isConnecting = true;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2_000,
      socketTimeoutMS: 4_000,
      connectTimeoutMS: 2_000,
      autoIndex: false,
    });
    isOfflineMode = false;
  } catch {
    isOfflineMode = true;
    try {
      await mongoose.disconnect();
    } catch {
      // Clean up
    }
  } finally {
    isConnecting = false;
  }
}

export { mongoose };
