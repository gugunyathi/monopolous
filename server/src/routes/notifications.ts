import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/auth.js';

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
  if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
    try {
      const parsed = new URL(targetPath);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return '/';
    }
  }
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

function composeRichMessage(params: {
  message: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  mediaUrl?: string;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  section?: string;
}): string {
  const lines: string[] = [params.message];
  if (params.subtitle) lines.push(params.subtitle);
  if (params.ctaLabel && params.ctaUrl) lines.push(`${params.ctaLabel}: ${params.ctaUrl}`);
  if (params.mediaUrl) lines.push(`Media: ${params.mediaUrl}`);
  if (params.section) lines.push(`Section: ${params.section}`);
  if (params.fontFamily || params.fontWeight || params.textColor) {
    lines.push(`Style: font=${params.fontFamily ?? 'default'}, weight=${params.fontWeight ?? 'default'}, color=${params.textColor ?? 'default'}`);
  }
  return lines.join('\n\n');
}

function appendQuery(path: string | undefined, query: Record<string, string | undefined>): string | undefined {
  if (!path) return path;
  const [base, hashPart] = path.split('#', 2);
  const [pathname, existingQuery] = base.split('?', 2);
  const params = new URLSearchParams(existingQuery ?? '');

  for (const [key, value] of Object.entries(query)) {
    if (value && value.trim()) params.set(key, value.trim());
  }

  const queryString = params.toString();
  const rebuilt = `${pathname}${queryString ? `?${queryString}` : ''}`;
  return hashPart ? `${rebuilt}#${hashPart}` : rebuilt;
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

async function getConsentedUsers(): Promise<AppUser[]> {
  const users: AppUser[] = [];
  let cursor: string | undefined;

  do {
    const page = await getUsersPage(cursor);
    users.push(...page.users);
    cursor = page.nextCursor;
  } while (cursor);

  const dedup = new Map<string, AppUser>();
  for (const user of users) {
    dedup.set(user.address.toLowerCase(), user);
  }
  return Array.from(dedup.values());
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

router.get('/consented-users', sendLimiter, requireAdmin, async (_req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Notifications are not configured on the server.' });
    return;
  }

  try {
    const users = await getConsentedUsers();
    res.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      total: users.length,
      users,
    });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Notification service unavailable.' });
  }
});

router.post('/send-broadcast', sendLimiter, requireAdmin, async (req: Request, res: Response) => {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Notifications are not configured on the server.' });
    return;
  }

  const title = req.body?.title as string | undefined;
  const message = req.body?.message as string | undefined;
  const targetPath = req.body?.targetPath as string | undefined;
  const subtitle = req.body?.subtitle as string | undefined;
  const ctaLabel = req.body?.ctaLabel as string | undefined;
  const ctaUrl = req.body?.ctaUrl as string | undefined;
  const imageUrl = req.body?.imageUrl as string | undefined;
  const mediaUrl = req.body?.mediaUrl as string | undefined;
  const section = req.body?.section as string | undefined;
  const textColor = req.body?.textColor as string | undefined;
  const fontFamily = req.body?.fontFamily as string | undefined;
  const fontWeight = req.body?.fontWeight as string | undefined;

  if (!title || !message) {
    res.status(400).json({ error: 'title and message are required.' });
    return;
  }

  const normalizedTitle = clip(title, 30);
  const normalizedMessage = clip(composeRichMessage({ message, subtitle, ctaLabel, ctaUrl, mediaUrl, section, textColor, fontFamily, fontWeight }), 200);
  const normalizedTargetPath = appendQuery(normalizeTargetPath(targetPath), {
    section,
    ntitle: title,
    nmsg: message,
    nsub: subtitle,
    nmedia: mediaUrl,
    ncta: ctaLabel,
    nctau: ctaUrl,
    nfont: fontFamily,
    nweight: fontWeight,
    ncolor: textColor,
  });

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
    const parsed = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
    res.json({
      ...parsed,
      preview: {
        title: normalizedTitle,
        message: normalizedMessage,
        targetPath: normalizedTargetPath,
        subtitle: subtitle ? clip(subtitle, 80) : undefined,
        ctaLabel: ctaLabel ? clip(ctaLabel, 30) : undefined,
        ctaUrl: ctaUrl ? clip(ctaUrl, 180) : undefined,
        imageUrl: imageUrl ? clip(imageUrl, 180) : undefined,
        mediaUrl: mediaUrl ? clip(mediaUrl, 180) : undefined,
        section: section ? clip(section, 20) : undefined,
        textColor: textColor ? clip(textColor, 30) : undefined,
        fontFamily: fontFamily ? clip(fontFamily, 40) : undefined,
        fontWeight: fontWeight ? clip(fontWeight, 20) : undefined,
      },
      audienceCount: walletAddresses.length,
    });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Notification service unavailable.' });
  }
});

export default router;
