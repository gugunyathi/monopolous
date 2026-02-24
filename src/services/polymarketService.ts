/**
 * Polymarket Service
 *
 * Connects agents to Polymarket prediction markets as part of their
 * investment strategy. Supports:
 *
 *   1. Browse / search markets  — public Gamma API, no auth needed
 *   2. Fetch prices / order book — public CLOB API, no auth needed
 *   3. Place bets               — SIMULATED by default (POLYMARKET_SIMULATED=true)
 *                                 Real trading requires Polygon USDC + MATIC gas
 *
 * Chain note: Polymarket runs on Polygon (chain 137). For real trading,
 * agents need USDC bridged from Base → Polygon. See bridgeFundingStep().
 *
 * Real trading path (when POLYMARKET_SIMULATED = false):
 *   1. Agent has a Polygon-compatible private key in env
 *   2. USDC is on Polygon (use bridge deposit flow)
 *   3. Approvals set via approve set (needs MATIC)
 *   4. Place orders via @polymarket/clob-client
 *
 * CORS: Gamma API allows browser requests. If CLOB auth requests get blocked,
 * add a Vercel Edge Function at /api/polymarket/[...path] as a proxy.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * When true, bet placement is fully simulated — no real funds move,
 * no Polygon transactions. Market browsing / price reads are always real.
 * Flip to false once agents have Polygon USDC funded.
 */
export const POLYMARKET_SIMULATED = true;

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API  = 'https://clob.polymarket.com';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PolyMarket {
  id:            string;
  slug:          string;
  question:      string;
  description?:  string;
  active:        boolean;
  closed:        boolean;
  volume?:       string;   // string USD
  liquidity?:    string;
  endDate?:      string;
  tags?:         Array<{ label: string }>;
  // Outcome tokens (YES=index 0, NO=index 1 for binary markets)
  tokens?:       Array<{ token_id: string; outcome: string; price?: string }>;
  outcomePrices?: string[];  // ["0.62", "0.38"] for YES/NO
  conditionId?:  string;
}

export interface PolyBetResult {
  simulated:   boolean;
  marketId:    string;
  question:    string;
  side:        'YES' | 'NO';
  amount:      number;     // USDC
  price:       number;     // 0-1 probability
  shares:      number;     // shares bought
  potentialWin: number;    // if correct
  txHash?:     string;     // real tx hash when not simulated
  orderId?:    string;
}

// ─── Market Search ────────────────────────────────────────────────────────────

/**
 * Search active Polymarket markets by keyword.
 * Returns up to `limit` markets with current YES prices.
 * No authentication required.
 */
export async function searchMarkets(
  query: string,
  limit = 5,
): Promise<PolyMarket[]> {
  try {
    // Gamma API supports ?q= search with ?active=true filter
    const url = `${GAMMA_API}/markets?q=${encodeURIComponent(query)}&active=true&closed=false&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[Polymarket] Gamma API ${res.status}: ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    // Gamma returns { markets: [...] } or directly [...]
    const markets: PolyMarket[] = Array.isArray(data) ? data : (data.markets ?? []);
    return markets.slice(0, limit);
  } catch (err: any) {
    console.warn('[Polymarket] searchMarkets error:', err.message);
    return [];
  }
}

/**
 * Get trending / high-volume active markets (no search query).
 */
export async function getTrendingMarkets(limit = 5): Promise<PolyMarket[]> {
  try {
    const url = `${GAMMA_API}/markets?active=true&closed=false&order=volume_num&ascending=false&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : (data.markets ?? [])).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get the current mid-price for a CLOB token (YES token typically).
 * Returns 0-1 probability or null on failure.
 */
export async function getMarketMidPrice(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.mid === 'string' ? parseFloat(data.mid) : (data.mid ?? null);
  } catch {
    return null;
  }
}

// ─── Simulated Bet Execution ──────────────────────────────────────────────────

/**
 * Place a prediction market bet.
 *
 * When POLYMARKET_SIMULATED=true:
 *   - Deducts USDC from the agent's internal balance (same as execute_trade)
 *   - Does NOT touch Polygon or any real wallet
 *   - Returns a PolyBetResult with simulated=true
 *
 * When POLYMARKET_SIMULATED=false (future):
 *   - Requires POLYMARKET_PRIVATE_KEY in env
 *   - Uses @polymarket/clob-client to place a real order
 *   - Agent must have Polygon USDC and MATIC (gas)
 */
export async function placeBet(
  agentPrivateKey: string | null,
  tokenId: string,
  market:  PolyMarket,
  side:    'YES' | 'NO',
  amount:  number,   // USDC
  price?:  number,   // 0-1; if omitted, fetches live mid-price
): Promise<PolyBetResult> {
  // Resolve the price if not provided
  let resolvedPrice = price ?? (await getMarketMidPrice(tokenId)) ?? 0.5;
  // Clamp to valid probability range
  resolvedPrice = Math.min(0.99, Math.max(0.01, resolvedPrice));

  const shares = amount / resolvedPrice;
  const potentialWin = shares; // each share pays $1 if correct

  if (POLYMARKET_SIMULATED || !agentPrivateKey) {
    // ── Simulated path ────────────────────────────────────
    console.log(
      `[Polymarket] 🎲 SIMULATED bet: ${side} $${amount} on "${market.question.slice(0, 60)}" @ ${(resolvedPrice * 100).toFixed(1)}¢`,
    );

    return {
      simulated:    true,
      marketId:     market.id,
      question:     market.question,
      side,
      amount,
      price:        resolvedPrice,
      shares:       Math.round(shares * 100) / 100,
      potentialWin: Math.round(potentialWin * 100) / 100,
    };
  }

  // ── Real path (future — requires Polygon USDC + MATIC) ────────────────────
  // NOTE: Uncomment and implement when agents are funded on Polygon.
  //
  // import { ClobClient, Side } from '@polymarket/clob-client';
  // import { Wallet } from 'ethers';
  //
  // const signer = new Wallet(agentPrivateKey);
  // const client = new ClobClient(CLOB_API, 137, signer);
  // const order = await client.createMarketOrder({
  //   tokenID: tokenId,
  //   side: side === 'YES' ? Side.BUY : Side.SELL,
  //   amount,
  // });
  // const result = await client.placeOrder(order);
  // return { simulated: false, marketId: market.id, question: market.question,
  //          side, amount, price: resolvedPrice, shares, potentialWin,
  //          orderId: result.orderID };

  throw new Error('Real Polymarket trading not yet enabled — fund agents on Polygon first');
}

// ─── Bridge Funding Step ──────────────────────────────────────────────────────

/**
 * Returns instructions for bridging USDC from Base → Polygon for an agent wallet.
 * This is informational — actual bridging is an on-chain txn the operator does.
 *
 * Uses Polymarket's official bridge API to get the Polygon deposit address.
 */
export async function getBridgeFundingInstructions(
  polygonAddress: string,
): Promise<{ depositAddress: string; instructions: string } | null> {
  try {
    const res = await fetch(`${GAMMA_API}/bridge/deposit/${polygonAddress}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      // Fallback: manual bridge instructions
      return {
        depositAddress: polygonAddress,
        instructions:
          `To fund Polymarket trading:\n` +
          `1. Bridge USDC from Base to Polygon via https://bridge.base.org\n` +
          `2. Get MATIC for gas via https://wallet.polygon.technology/\n` +
          `3. Approve Polymarket contracts: polymarket approve set\n` +
          `4. Deposit address on Polygon: ${polygonAddress}`,
      };
    }

    const data = await res.json();
    return {
      depositAddress: data.deposit_address ?? polygonAddress,
      instructions:
        `Bridge USDC from Base to Polygon:\n` +
        `• Polygon deposit address: ${data.deposit_address ?? polygonAddress}\n` +
        `• Minimum: $10 USDC\n` +
        `• Also get MATIC for gas\n` +
        `• After bridging, run polymarket approve set`,
    };
  } catch {
    return null;
  }
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/** Format a market for a social post summary. */
export function formatMarketForPost(m: PolyMarket): string {
  const prices = m.outcomePrices ?? [];
  const yesPrice = prices[0] ? `${(parseFloat(prices[0]) * 100).toFixed(0)}¢` : '??¢';
  const vol = m.volume ? `$${(parseFloat(m.volume) / 1_000_000).toFixed(1)}M` : '?';
  const end = m.endDate ? ` | ends ${new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : '';
  return `"${m.question.slice(0, 80)}"\nYES: ${yesPrice}  |  Vol: ${vol}${end}`;
}

/** Pick the most relevant token_id for a market (YES token). */
export function getYesTokenId(m: PolyMarket): string | null {
  if (m.tokens && m.tokens.length > 0) {
    const yesToken = m.tokens.find((t) => t.outcome?.toUpperCase() === 'YES') ?? m.tokens[0];
    return yesToken.token_id;
  }
  return null;
}

// ─── Background Feed Polling ──────────────────────────────────────────────────

const FEED_TOPICS = ['crypto', 'bitcoin', 'ethereum', 'defi', 'federal reserve'];
let polyFeedTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch a combined set of trending + topic-specific markets.
 * Used by the background feed and by agents.
 */
export async function fetchAndStorePredictionMarkets(): Promise<PolyMarket[]> {
  try {
    const [trending, ...topicResults] = await Promise.allSettled([
      getTrendingMarkets(6),
      ...FEED_TOPICS.slice(0, 3).map((t) => searchMarkets(t, 3)),
    ]);

    const seen = new Set<string>();
    const markets: PolyMarket[] = [];

    const addAll = (arr: PolyMarket[]) => {
      for (const m of arr) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          markets.push(m);
        }
      }
    };

    if (trending.status === 'fulfilled') addAll(trending.value);
    for (const r of topicResults) {
      if (r.status === 'fulfilled') addAll(r.value);
    }

    return markets.slice(0, 15);
  } catch (err: any) {
    console.warn('[Polymarket] fetchAndStorePredictionMarkets error:', err.message);
    return [];
  }
}

/**
 * Start the background market feed. Calls `onUpdate` immediately and every 2 minutes.
 * Safe to call multiple times — only one feed runs at a time.
 */
export function startPolymarketFeed(onUpdate: (markets: PolyMarket[]) => void): void {
  if (polyFeedTimer) return;

  // Initial fetch (non-blocking)
  fetchAndStorePredictionMarkets()
    .then(onUpdate)
    .catch((e) => console.warn('[Polymarket] initial fetch error:', e));

  polyFeedTimer = setInterval(() => {
    fetchAndStorePredictionMarkets()
      .then(onUpdate)
      .catch((e) => console.warn('[Polymarket] refresh error:', e));
  }, 120_000); // refresh every 2 minutes

  console.log('[Polymarket] Feed started — refreshes every 2 minutes.');
}

/** Stop the background market feed. */
export function stopPolymarketFeed(): void {
  if (polyFeedTimer) {
    clearInterval(polyFeedTimer);
    polyFeedTimer = null;
  }
}
