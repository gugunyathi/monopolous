/**
 * Monopolous API Service
 *
 * Centralised HTTP client for the Express/MongoDB backend.
 * All calls are fire-and-forget friendly — errors are logged but never thrown
 * to the caller, so the in-memory Zustand store always stays the source of
 * truth for the UI.
 *
 * Auth flow:
 *  1. Player signs a nonce challenge with their Base wallet
 *  2. Backend verifies the signature and issues a JWT (7-day expiry)
 *  3. JWT is stored in localStorage and sent as Bearer token on every request
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'monopolous_jwt';
const SESSION_KEY = 'monopolous_session_id';

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = false,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else if (requiresAuth) return { data: null, error: 'Not authenticated' };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      clearToken();
      return { data: null, error: 'Authentication expired' };
    }

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? `HTTP ${res.status}` };

    return { data: json as T, error: null };
  } catch (err) {
    console.error(`[API] ${options.method ?? 'GET'} ${path} failed:`, err);
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Step 1: Request a sign-in nonce for a wallet address */
export async function requestNonce(address: string): Promise<string | null> {
  const { data } = await apiFetch<{ nonce: string }>('/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
  return data?.nonce ?? null;
}

/** Step 2: Verify wallet signature and receive JWT */
export async function verifySignature(
  address: string,
  signature: string,
  nonce: string,
): Promise<{ token: string; user: UserProfile } | null> {
  const { data } = await apiFetch<{ token: string; user: UserProfile }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, signature, nonce }),
  });
  if (data?.token) setToken(data.token);
  return data;
}

/** Get current authenticated user */
export async function getMe(): Promise<UserProfile | null> {
  const { data } = await apiFetch<UserProfile>('/auth/me', {}, true);
  return data;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  address: string;
  displayName?: string;
  ens?: string;
  avatarUrl?: string;
  totalGamesPlayed: number;
  totalTradesExecuted: number;
  totalTokensLaunched: number;
  allTimeBestBalance: number;
  firstLoginAt: string;
  lastActiveAt: string;
  farcasterUsername?: string;
}

export interface SessionData {
  sessionId: string;
  startBalance: number;
  endBalance?: number;
  peakBalance: number;
  finalRank?: number;
  finalNetWorth?: number;
  tradesCount: number;
  tokensLaunched: number;
  propertiesOwned: PropertyRecord[];
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
}

export interface PropertyRecord {
  tileId: string;
  tileName: string;
  purchasedAt: string;
  purchasePrice: number;
}

export interface TradeRecord {
  sessionId: string;
  agentIndex: number;
  tradeType: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount?: number;
  balanceBefore: number;
  balanceAfter: number;
  pnl?: number;
  txHash?: string;
  chain: string;
  simulated: boolean;
  triggerReason?: string;
  timestamp: string;
}

export interface TokenLaunchRecord {
  sessionId: string;
  deployerAgentIndex: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  poolId: string;
  txHash?: string;
  chain: string;
  simulated: boolean;
  totalFeesClaimed: number;
  deployedAt: string;
}

export interface AgentStateRecord {
  agentIndex: number;
  currentBalance: number;
  currentNetWorth: number;
  currentRank: number;
  propertiesOwned: string[];
  totalTradesCount: number;
  totalTokensLaunched: number;
  isADKActive: boolean;
  bnkrWalletId?: string;
  lastActiveAt: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUser(address: string): Promise<UserProfile | null> {
  const { data } = await apiFetch<UserProfile>(`/users/${address}`);
  return data;
}

export async function updateMe(updates: Partial<UserProfile>): Promise<boolean> {
  const { error } = await apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, true);
  return error === null;
}

export async function getUserHistory(address: string, limit = 20): Promise<SessionData[]> {
  const { data } = await apiFetch<{ sessions: SessionData[] }>(
    `/users/${address}/history?limit=${limit}`,
  );
  return data?.sessions ?? [];
}

// ─── Game Sessions ────────────────────────────────────────────────────────────

export async function startSession(startBalance = 1500): Promise<string | null> {
  const { data } = await apiFetch<{ sessionId: string }>('/game/sessions', {
    method: 'POST',
    body: JSON.stringify({ startBalance }),
  }, true);
  if (data?.sessionId) setSessionId(data.sessionId);
  return data?.sessionId ?? null;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<SessionData, 'sessionId' | 'startedAt' | 'isActive'>>,
): Promise<void> {
  await apiFetch(`/game/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, true);
}

export async function endSession(
  sessionId: string,
  finalBalance: number,
  finalRank?: number,
  finalNetWorth?: number,
  propertiesOwned?: PropertyRecord[],
): Promise<void> {
  await apiFetch(`/game/sessions/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({ finalBalance, finalRank, finalNetWorth, propertiesOwned }),
  }, true);
}

// ─── Trades ───────────────────────────────────────────────────────────────────

export async function recordTrade(trade: Omit<TradeRecord, 'timestamp'>): Promise<boolean> {
  const { error } = await apiFetch('/trades', {
    method: 'POST',
    body: JSON.stringify(trade),
  }, true);
  return error === null;
}

export async function recordTradeBatch(trades: Omit<TradeRecord, 'timestamp'>[]): Promise<boolean> {
  if (trades.length === 0) return true;
  const { error } = await apiFetch('/trades/batch', {
    method: 'POST',
    body: JSON.stringify({ trades }),
  }, true);
  return error === null;
}

export async function getTrades(params?: {
  agentIndex?: number;
  sessionId?: string;
  limit?: number;
  page?: number;
}): Promise<{ trades: TradeRecord[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.agentIndex !== undefined) q.set('agentIndex', String(params.agentIndex));
  if (params?.sessionId) q.set('sessionId', params.sessionId);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.page) q.set('page', String(params.page));

  const { data } = await apiFetch<{ trades: TradeRecord[]; total: number }>(
    `/trades?${q.toString()}`,
  );
  return data ?? { trades: [], total: 0 };
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

export async function recordTokenLaunch(token: Omit<TokenLaunchRecord, 'totalFeesClaimed' | 'deployedAt'>): Promise<boolean> {
  const { error } = await apiFetch('/tokens', {
    method: 'POST',
    body: JSON.stringify(token),
  }, true);
  return error === null;
}

export async function getTokens(params?: {
  agentIndex?: number;
  sessionId?: string;
  limit?: number;
}): Promise<TokenLaunchRecord[]> {
  const q = new URLSearchParams();
  if (params?.agentIndex !== undefined) q.set('agentIndex', String(params.agentIndex));
  if (params?.sessionId) q.set('sessionId', params.sessionId);
  if (params?.limit) q.set('limit', String(params.limit));

  const { data } = await apiFetch<{ tokens: TokenLaunchRecord[] }>(`/tokens?${q.toString()}`);
  return data?.tokens ?? [];
}

export async function claimTokenFees(tokenAddress: string, feesClaimed: number): Promise<boolean> {
  const { error } = await apiFetch(`/tokens/${tokenAddress}/fees`, {
    method: 'PATCH',
    body: JSON.stringify({ feesClaimed }),
  }, true);
  return error === null;
}

// ─── Agent States ─────────────────────────────────────────────────────────────

export async function syncAgentStates(states: Partial<AgentStateRecord>[]): Promise<boolean> {
  if (states.length === 0) return true;
  const { error } = await apiFetch('/agents/state/batch', {
    method: 'POST',
    body: JSON.stringify({ states }),
  }, true);
  return error === null;
}

export async function updateAgentState(
  agentIndex: number,
  updates: Partial<AgentStateRecord>,
): Promise<boolean> {
  const { error } = await apiFetch(`/agents/${agentIndex}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, true);
  return error === null;
}

export async function getAgentState(agentIndex: number): Promise<AgentStateRecord | null> {
  const { data } = await apiFetch<{ agent: AgentStateRecord }>(`/agents/${agentIndex}`);
  return data?.agent ?? null;
}

// ─── Social Feed ──────────────────────────────────────────────────────────────

export async function persistPost(post: {
  id: string;
  agentIndex: number;
  sessionId: string;
  type: string;
  content: string;
  token?: string;
  action?: string;
  likes: number;
  timestamp: number;
  postCategory?: string;
  isADK?: boolean;
}): Promise<void> {
  await apiFetch('/social/posts', {
    method: 'POST',
    body: JSON.stringify(post),
  }, true);
}

export async function persistPostBatch(posts: Parameters<typeof persistPost>[0][]): Promise<void> {
  if (posts.length === 0) return;
  await apiFetch('/social/posts/batch', {
    method: 'POST',
    body: JSON.stringify({ posts }),
  }, true);
}

export async function getHistoricalPosts(params?: {
  agentIndex?: number;
  sessionId?: string;
  limit?: number;
  before?: number;
}): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (params?.agentIndex !== undefined) q.set('agentIndex', String(params.agentIndex));
  if (params?.sessionId) q.set('sessionId', params.sessionId);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.before) q.set('before', String(params.before));

  const { data } = await apiFetch<{ posts: unknown[] }>(`/social/posts?${q.toString()}`);
  return data?.posts ?? [];
}

// ─── Properties ───────────────────────────────────────────────────────────────

export async function recordPropertyPurchase(params: {
  agentIndex: number;
  tileId: string;
  tileName: string;
  purchasePrice: number;
  sessionId: string;
  balanceBefore: number;
  balanceAfter: number;
}): Promise<boolean> {
  const { error } = await apiFetch('/game/properties', {
    method: 'POST',
    body: JSON.stringify(params),
  }, true);
  return error === null;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<AgentStateRecord[]> {
  const { data } = await apiFetch<{ leaderboard: AgentStateRecord[] }>('/game/leaderboard');
  return data?.leaderboard ?? [];
}

export async function getAllTimeLeaderboard(): Promise<unknown[]> {
  const { data } = await apiFetch<{ leaderboard: unknown[] }>('/game/leaderboard/all-time');
  return data?.leaderboard ?? [];
}

// ─── Sign-In with Base Wallet ─────────────────────────────────────────────────

/**
 * Full wallet sign-in flow:
 *  1. Request nonce from backend
 *  2. Sign with wallet (using Base Account SDK - caller must pass signFn)
 *  3. Verify signature with backend
 *  4. Store JWT, start a game session
 */
export async function walletSignIn(
  address: string,
  signFn: (message: string) => Promise<string>,
): Promise<{ token: string; user: UserProfile; sessionId: string } | null> {
  const nonce = await requestNonce(address);
  if (!nonce) {
    console.error('[API] Failed to get nonce');
    return null;
  }

  const message = `Sign in to Monopolous\n\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

  let signature: string;
  try {
    signature = await signFn(message);
  } catch (err) {
    console.error('[API] Wallet signature rejected:', err);
    return null;
  }

  const result = await verifySignature(address, signature, nonce);
  if (!result) {
    console.error('[API] Signature verification failed');
    return null;
  }

  // Start a new game session
  const sessionId = await startSession(1500);
  if (!sessionId) console.warn('[API] Failed to create session (continuing without persistence)');

  return { ...result, sessionId: sessionId ?? '' };
}
