import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';

const router = Router();

const BASE_DASHBOARD_NOTIFICATIONS_API = 'https://dashboard.base.org/api/v1/notifications';

const NOTIFICATIONS_API_KEY =
  process.env.BASE_NOTIFICATIONS_API_KEY ??
  process.env.VITE_BASE_NOTIFICATIONS_API_KEY ??
  process.env['VITE_BASE-NOTIFICATIONS_API_KEY'];

const REGISTERED_APP_URL =
  process.env.APP_URL ??
  process.env.VITE_APP_URL;

const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Notifications rate limit exceeded. Please retry shortly.' },
});

const dedupeCache = new Map<string, number>();
const DEDUPE_TTL_MS = 60_000;

interface AppUser {
  address: string;
  notificationsEnabled: boolean;
}

interface UsersResponse {
  success: boolean;
  users: AppUser[];
  nextCursor?: string;
}

function isConfigured(): boolean {
  return Boolean(NOTIFICATIONS_API_KEY && REGISTERED_APP_URL);
}

function makeHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': NOTIFICATIONS_API_KEY ?? '',
  };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function normalizeTargetPath(targetPath?: string): string | undefined {
  if (!targetPath) return undefined;
  return targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
}

function cleanupDedupeCache(): void {
  const now = Date.now();
  for (const [key, timestamp] of dedupeCache) {
    if (now - timestamp > DEDUPE_TTL_MS) dedupeCache.delete(key);
  }
}

function isDuplicateRequest(payload: { title: string; message: string; targetPath?: string }): boolean {
  cleanupDedupeCache();
  const key = `${payload.title}::${payload.message}::${payload.targetPath ?? ''}`;
  const now = Date.now();
  const lastSent = dedupeCache.get(key);
  if (lastSent && now - lastSent < DEDUPE_TTL_MS) return true;
  dedupeCache.set(key, now);
  return false;
}

async function getUsersPage(cursor?: string): Promise<UsersResponse> {
  const url = new URL(`${BASE_DASHBOARD_NOTIFICATIONS_API}/app/users`);
  url.searchParams.set('app_url', REGISTERED_APP_URL ?? '');
  url.searchParams.set('notification_enabled', 'true');
  url.searchParams.set('limit', '500');
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await fetch(url.toString(), { headers: makeHeaders() });
  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Notifications users fetch failed (${response.status}): ${reason}`);
  }

  return response.json() as Promise<UsersResponse>;
}

async function getAudienceAddresses(): Promise<string[]> {
  const addresses: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await getUsersPage(cursor);
    addresses.push(...page.users.map((u) => u.address));
    cursor = page.nextCursor;
  } while (cursor);

  return Array.from(new Set(addresses));
}

router.post('/user-status', async (req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Notifications are not configured on the server.' });
    return;
  }

  const walletAddress = req.body?.walletAddress as string | undefined;
  if (!walletAddress || typeof walletAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: 'Valid walletAddress is required.' });
    return;
  }

  try {
    const response = await fetch(`${BASE_DASHBOARD_NOTIFICATIONS_API}/app/user/status`, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        app_url: REGISTERED_APP_URL,
        wallet_address: walletAddress,
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: bodyText || 'Failed to fetch notification status.' });
      return;
    }

    res.type('application/json').send(bodyText);
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Notification service unavailable.' });
  }
});

router.post('/send-broadcast', sendLimiter, requireAuth, async (req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Notifications are not configured on the server.' });
    return;
  }

  const title = req.body?.title as string | undefined;
  const message = req.body?.message as string | undefined;
  const targetPath = req.body?.targetPath as string | undefined;

  if (!title || !message) {
    res.status(400).json({ error: 'title and message are required.' });
    return;
  }

  const normalizedTitle = clip(title, 30);
  const normalizedMessage = clip(message, 200);
  const normalizedTargetPath = normalizeTargetPath(targetPath);

  if (isDuplicateRequest({ title: normalizedTitle, message: normalizedMessage, targetPath: normalizedTargetPath })) {
    res.json({ success: true, deduped: true, sentCount: 0, failedCount: 0, results: [] });
    return;
  }

  try {
    const walletAddresses = await getAudienceAddresses();
    if (walletAddresses.length === 0) {
      res.json({ success: true, sentCount: 0, failedCount: 0, results: [] });
      return;
    }

    const response = await fetch(`${BASE_DASHBOARD_NOTIFICATIONS_API}/send`, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        app_url: REGISTERED_APP_URL,
        wallet_addresses: walletAddresses.slice(0, 1000),
        title: normalizedTitle,
        message: normalizedMessage,
        ...(normalizedTargetPath ? { target_path: normalizedTargetPath } : {}),
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: bodyText || 'Failed to send notification.' });
      return;
    }

    res.type('application/json').send(bodyText);
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Notification service unavailable.' });
  }
});

export default router;
